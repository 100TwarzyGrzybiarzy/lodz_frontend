let processedMedicines = [];
// Mockowe dane dla powiadomień, inwentarza, raportów - można je zostawić lub usunąć jeśli niepotrzebne
const mockNotifications = [{ id: 1, title: "Nowe wycofanie: Paracetamol 500mg", time: "2025-04-10 09:15", message: "Seria LOT2025001 została wycofana z powodu zanieczyszczenia substancji aktywnej." }, { id: 2, title: "Nowe wycofanie: Amoksycylina 1000mg", time: "2025-04-12 14:30", message: "Seria LOT2025002 została wycofana z powodu błędu w oznaczeniu na opakowaniu." }];
const mockInventory = { wytwórnia: [], hurtownia: [], apteka: [], gif: [] };
let mockReportDefinitions = [{ id: 'rep_def_1', name: "Raport wycofanych leków (ostatnie 30 dni)", description: "Generuje listę leków wycofanych w ciągu ostatnich 30 dni." }];

let currentUser = null;
let currentRole = null;

function formatDate(dateString) {
    if (!dateString) return 'Brak danych';
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    try {
        if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [year, month, day] = dateString.split('-');
            return `${day}.${month}.${year}`;
        }
        return new Date(dateString).toLocaleDateString('pl-PL', options);
    } catch (e) {
        console.warn("Nieprawidłowy format daty:", dateString);
        return dateString;
    }
}

const roleTranslations = {
    'wytwórnia': 'Wytwórnia',
    'hurtownia': 'Hurtownia',
    'apteka': 'Apteka',
    'gif': 'GIF Inspektor'
};

async function fetchDataAndInitialize() {
    try {
        const response = await fetch('http://localhost:8000/drugs');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const apiJson = await response.json();
        processGifData(apiJson);
        loadMedicinesTable();
    } catch (error) {
        console.error("Nie udało się pobrać lub przetworzyć danych o lekach:", error);
        const tableBody = document.querySelector('#medicines-table tbody');
        if(tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Błąd ładowania danych. Sprawdź konsolę.</td></tr>';
        } else {
            alert("Wystąpił błąd podczas ładowania danych o lekach. Sprawdź konsolę, aby uzyskać więcej informacji.");
        }
        processedMedicines = [];
    }
}

function processGifData(apiJson) {
    if (!apiJson || !apiJson.Decyzje || !Array.isArray(apiJson.Decyzje.Decyzja)) {
        console.error("Otrzymano nieprawidłowy format danych z API.");
        processedMedicines = [];
        return;
    }

    const decyzje = apiJson.Decyzje.Decyzja;
    decyzje.sort((a, b) => new Date(b.DataDecyzji) - new Date(a.DataDecyzji));

    processedMedicines = decyzje
        .filter(decyzja => {
             const validDecisionTypes = ["WYCOFANIE_Z_OBROTU", "ZAKAZ_WPROWADZENIA", "WSTRZYMANIE_W_OBROCIE", "DECYZJA_GIF_MANUALNA"]; // Dodane dla wpisów manualnych
             return decyzja.RodzajDecyzji && validDecisionTypes.includes(decyzja.RodzajDecyzji);
        })
        .map(decyzja => {
            let status = '';
            let statusText = decyzja.RodzajDecyzji ? decyzja.RodzajDecyzji.replace(/_/g, ' ') : 'Nieznany';
            statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1).toLowerCase();

            if (decyzja.RodzajDecyzji === "WYCOFANIE_Z_OBROTU" || decyzja.RodzajDecyzji === "ZAKAZ_WPROWADZENIA" || decyzja.RodzajDecyzji === "DECYZJA_GIF_MANUALNA") {
                status = 'withdrawn';
            } else if (decyzja.RodzajDecyzji === "WSTRZYMANIE_W_OBROCIE") {
                status = 'active';
            }

            let batchNumbers = "Wszystkie";
            if (decyzja.Serie && decyzja.Serie.Seria) {
                const serieArray = Array.isArray(decyzja.Serie.Seria) ? decyzja.Serie.Seria : [decyzja.Serie.Seria];
                const validSeries = serieArray.filter(s => s && s.NumerSerii).map(s => s.NumerSerii);
                if (validSeries.length > 0) {
                    batchNumbers = validSeries.join(', ');
                }
            }
            // Poprawka dla ID, aby było bardziej unikalne dla wpisów manualnych
            const idFromLink = decyzja.LinkDoPobraniaDecyzji ? decyzja.LinkDoPobraniaDecyzji.split('/').pop() : null;
            const decisionId = decyzja.NumerDecyzji || idFromLink || `LOCAL_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;


            return {
                id: decisionId,
                name: decyzja.NazwaProduktuLeczniczego || "Brak nazwy",
                batchNumber: batchNumbers,
                withdrawalDate: decyzja.DataDecyzji,
                reason: decyzja.RodzajDecyzji ? decyzja.RodzajDecyzji.replace(/_/g, ' ') : 'Brak',
                status: status,
                statusText: statusText,
                apiData: decyzja
            };
        });
}

function loadMedicinesTable() {
    const tableBody = document.querySelector('#medicines-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (processedMedicines.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Brak danych o decyzjach GIF lub dane nie zostały jeszcze załadowane.</td></tr>';
        return;
    }

    processedMedicines.forEach(medicine => {
        const row = document.createElement('tr');
        const statusClass = medicine.status === 'active' ? 'status-active' : (medicine.status === 'withdrawn' ? 'status-withdrawn' : 'status-unknown');
        const displayedStatusText = medicine.statusText || (medicine.status === 'active' ? 'Aktywny' : (medicine.status === 'withdrawn' ? 'Wycofany' : 'Nieznany'));

        row.innerHTML = `
            <td>${medicine.id || 'Brak ID'}</td>
            <td>${medicine.name}</td>
            <td>${medicine.batchNumber}</td>
            <td>${formatDate(medicine.withdrawalDate)}</td>
            <td>${medicine.reason}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${displayedStatusText}
                </span>
            </td>
            <td class="action-icons">
                <button class="view-btn" data-id="${medicine.id}"><i class="fas fa-eye"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            showMedicineDetails(this.dataset.id);
        });
    });
}

function showMedicineDetails(medicineId) {
    const medicine = processedMedicines.find(m => String(m.id) === String(medicineId));
    const detailsContent = document.getElementById('medicine-details-content');
    const modal = document.getElementById('medicine-details-modal');

    if (!detailsContent || !modal) return;

    if (!medicine || !medicine.apiData) {
        detailsContent.innerHTML = '<p>Nie znaleziono szczegółów dla tego leku.</p>';
        modal.classList.remove('hidden');
        return;
    }

    const details = medicine.apiData;
    const statusClass = medicine.status === 'active' ? 'status-active' : (medicine.status === 'withdrawn' ? 'status-withdrawn' : 'status-unknown');
    const displayedStatusText = medicine.statusText || (medicine.status === 'active' ? 'Aktywny' : (medicine.status === 'withdrawn' ? 'Wycofany' : 'Nieznany'));

    let serieInfo = "Brak danych o seriach / Dotyczy wszystkich serii";
    if (details.Serie && details.Serie.Seria) {
        const serieArray = Array.isArray(details.Serie.Seria) ? details.Serie.Seria : [details.Serie.Seria];
        const validSeries = serieArray.filter(s => s && s.NumerSerii);
        if (validSeries.length > 0) {
            serieInfo = '<ul>';
            validSeries.forEach(s => {
                serieInfo += `<li>Numer: ${s.NumerSerii}, Data ważności: ${formatDate(s.DataWaznosci) || 'Brak'}</li>`;
            });
            serieInfo += '</ul>';
        }
    }

    let gtinInfo = "Brak danych GTIN";
    if (details.ListaGTIN && details.ListaGTIN.GTIN) {
        const gtinArray = Array.isArray(details.ListaGTIN.GTIN) ? details.ListaGTIN.GTIN : [details.ListaGTIN.GTIN];
        const validGtins = gtinArray.filter(g => g && g.GTIN);
         if (validGtins.length > 0) {
            gtinInfo = '<ul>';
            validGtins.forEach(g => {
                gtinInfo += `<li>GTIN: ${g.GTIN}, Wielkość opakowania: ${g.WielkoscOpakowania || 'Brak'}</li>`;
            });
            gtinInfo += '</ul>';
        }
    }

    detailsContent.innerHTML = `
        <div class="medicine-details">
            <p><strong>Numer Decyzji/ID:</strong> ${details.NumerDecyzji || medicine.id || 'Brak'}</p>
            <p><strong>Link do Decyzji:</strong> ${details.LinkDoPobraniaDecyzji ? `<a href="${details.LinkDoPobraniaDecyzji}" target="_blank" rel="noopener noreferrer">Otwórz</a>` : 'Brak linku'}</p>
            <p><strong>Nazwa Produktu Leczniczego:</strong> ${details.NazwaProduktuLeczniczego || 'Brak danych'}</p>
            <p><strong>Moc:</strong> ${details.Moc || 'Brak danych'}</p>
            <p><strong>Postać:</strong> ${details.Postac || 'Brak danych'}</p>
            <p><strong>Podmiot Odpowiedzialny:</strong> ${details.NazwaPodmiotuOdpowiedzialnego || 'Brak danych'}</p>
            <hr>
            <p><strong>Data Decyzji:</strong> ${formatDate(details.DataDecyzji)}</p>
            <p><strong>Rodzaj Decyzji:</strong> ${details.RodzajDecyzji ? details.RodzajDecyzji.replace(/_/g, ' ') : 'Brak danych'}</p>
            <p><strong>Numer Sprawy:</strong> ${details.NumerSprawy || 'Brak danych'}</p>
            <hr>
            <p><strong>Status w systemie:</strong>
                <span class="status-badge ${statusClass}">
                    ${displayedStatusText}
                </span>
            </p>
            <h4>Serie Produktu:</h4>
            <div>${serieInfo}</div>
            <h4>Lista GTIN:</h4>
            <div>${gtinInfo}</div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function loadNotifications() {
    const container = document.querySelector('.notifications-container');
    if (!container) return;
    container.innerHTML = '';
    if (mockNotifications.length === 0) {
        container.innerHTML = '<p class="empty-message">Brak nowych powiadomień</p>';
        return;
    }
    mockNotifications.forEach(notification => {
        const card = document.createElement('div');
        card.className = 'notification-card';
        card.innerHTML = `
            <div class="notification-icon"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="notification-content">
                <h4>${notification.title}</h4>
                <p>${notification.message}</p>
                <p class="notification-time">${notification.time}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

function loadInventory() {
    const container = document.querySelector('.inventory-container');
    if (!container) return;
    container.innerHTML = '';
    if (!currentRole || !mockInventory[currentRole] || mockInventory[currentRole].length === 0) {
        container.innerHTML = '<p class="empty-message">Brak danych inwentarza dla tej roli.</p>';
        return;
    }
    const inventory = mockInventory[currentRole];
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr><th>ID</th><th>Nazwa leku</th><th>Numer serii</th><th>Ilość</th><th>Status</th></tr>
        </thead>
        <tbody>
            ${inventory.map(item => `
                <tr><td>${item.id}</td><td>${item.name}</td><td>${item.batchNumber}</td><td>${item.quantity} szt.</td><td><span class="status-badge status-active">Aktywny</span></td></tr>
            `).join('')}
        </tbody>
    `;
    container.appendChild(table);
}

function loadReports() {
    const container = document.querySelector('.reports-container');
    if (!container) return;
    container.innerHTML = '';
    const reportsList = document.createElement('ul');
    reportsList.className = 'reports-list';
    if (mockReportDefinitions.length === 0) {
        reportsList.innerHTML = `<p class="empty-message">Brak zdefiniowanych raportów. ${currentRole === 'gif' ? 'Możesz dodać nowe definicje.' : ''}</p>`;
    } else {
        mockReportDefinitions.forEach(reportDef => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <a href="#" class="report-link" data-report-id="${reportDef.id}">
                    <strong>${reportDef.name}</strong>
                    ${reportDef.description ? `<br><small>${reportDef.description}</small>` : ''}
                </a>
                ${currentRole === 'gif' ? `<button class="btn-delete-report-def" data-id="${reportDef.id}" title="Usuń definicję"><i class="fas fa-trash-alt"></i></button>` : ''}
            `;
            reportsList.appendChild(listItem);
        });
    }
    container.appendChild(reportsList);

    document.querySelectorAll('.report-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const reportId = this.dataset.reportId;
            const report = mockReportDefinitions.find(r => r.id === reportId);
            alert(`Generowanie raportu: ${report ? report.name : 'Nieznany raport'}...\n(Logika generowania raportu nie została zaimplementowana)`);
        });
    });

    if (currentRole === 'gif') {
        document.querySelectorAll('.btn-delete-report-def').forEach(button => {
            button.addEventListener('click', function() {
                const reportDefId = this.dataset.id;
                if (confirm('Czy na pewno chcesz usunąć tę definicję raportu?')) {
                    mockReportDefinitions = mockReportDefinitions.filter(def => def.id !== reportDefId);
                    loadReports();
                    alert('Definicja raportu została usunięta.');
                }
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const roleSelect = document.getElementById('role');
    const loggedUserSpan = document.getElementById('logged-user');
    const userRoleSpan = document.getElementById('user-role');
    const loginScreenDiv = document.getElementById('login-screen');
    const mainPanelDiv = document.getElementById('main-panel');
    const navItems = document.querySelectorAll('.nav-item');
    const panelSections = document.querySelectorAll('.panel-section');
    const searchLekiInput = document.getElementById('search-leki');

    const addReportDefinitionBtn = document.getElementById('add-report-definition-btn');
    const addReportDefinitionModal = document.getElementById('add-report-definition-modal');
    const submitReportDefinitionBtn = document.getElementById('submit-report-definition');
    const cancelReportDefinitionBtn = document.getElementById('cancel-report-definition');
    const reportDefNameInput = document.getElementById('report-definition-name');
    const reportDefDescInput = document.getElementById('report-definition-description');

    const gifWithdrawDrugBtn = document.getElementById('gif-issue-withdrawal-btn'); // Zaktualizowane ID przycisku GIF
    const gifWithdrawalFormModal = document.getElementById('gif-withdrawal-form-modal'); // Zaktualizowane ID modala GIF
    const gifDecisionForm = document.getElementById('gif-decision-form');
    const cancelGifDecisionBtn = document.getElementById('cancel-gif-decision');
    const gifDecisionDateInput = document.getElementById('gif-decision-date');

    const allModals = document.querySelectorAll('.modal');
    const allCloseBtns = document.querySelectorAll('.close');

    if (loginBtn) {
        loginBtn.addEventListener('click', async function() {
            const username = usernameInput.value;
            const password = passwordInput.value;
            const role = roleSelect.value;

            if (!username || !password || !role) {
                alert('Proszę wypełnić wszystkie pola!');
                return;
            }
            currentUser = username;
            currentRole = role;

            if(loggedUserSpan) loggedUserSpan.textContent = username;
            if(userRoleSpan) userRoleSpan.textContent = roleTranslations[role] || role;

            document.querySelectorAll('.hidden-role').forEach(el => {
                const visibleForRoles = el.dataset.visibleFor.split(' ');
                if (visibleForRoles.includes(currentRole)) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });

            if(loginScreenDiv) { loginScreenDiv.classList.remove('active'); loginScreenDiv.classList.add('hidden'); }
            if(mainPanelDiv) mainPanelDiv.classList.remove('hidden');

            await fetchDataAndInitialize();
            loadNotifications();
            loadInventory();
            loadReports();
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            currentUser = null;
            currentRole = null;
            processedMedicines = [];
            if(usernameInput) usernameInput.value = '';
            if(passwordInput) passwordInput.value = '';
            if(roleSelect) roleSelect.value = '';
            if(mainPanelDiv) mainPanelDiv.classList.add('hidden');
            if(loginScreenDiv) { loginScreenDiv.classList.remove('hidden'); loginScreenDiv.classList.add('active'); }
            const tableBody = document.querySelector('#medicines-table tbody');
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Wylogowano. Zaloguj się, aby zobaczyć dane.</td></tr>';
        });
    }

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            const targetSectionId = this.dataset.tab;
            panelSections.forEach(section => {
                section.classList.remove('active');
                section.classList.add('hidden');
            });
            const activeSection = document.getElementById(targetSectionId);
            if(activeSection) { activeSection.classList.add('active'); activeSection.classList.remove('hidden'); }
            if (targetSectionId === 'raporty') loadReports();
            if (targetSectionId === 'wycofane-leki') loadMedicinesTable();
            if (targetSectionId === 'powiadomienia') loadNotifications();
            if (targetSectionId === 'moj-inwentarz') loadInventory();
        });
    });

    if (addReportDefinitionBtn) {
        addReportDefinitionBtn.addEventListener('click', function() {
            if (currentRole === 'gif') {
                if(reportDefNameInput) reportDefNameInput.value = '';
                if(reportDefDescInput) reportDefDescInput.value = '';
                if(addReportDefinitionModal) addReportDefinitionModal.classList.remove('hidden');
            }
        });
    }

    if (submitReportDefinitionBtn) {
        submitReportDefinitionBtn.addEventListener('click', function() {
            const reportName = reportDefNameInput.value.trim();
            const reportDescription = reportDefDescInput.value.trim();
            if (!reportName) { alert('Nazwa raportu jest wymagana!'); return; }
            const newReportDef = { id: `rep_def_${Date.now().toString().substring(6)}`, name: reportName, description: reportDescription };
            mockReportDefinitions.push(newReportDef);
            loadReports();
            if(addReportDefinitionModal) addReportDefinitionModal.classList.add('hidden');
            alert('Definicja raportu została dodana!');
        });
    }

    if (cancelReportDefinitionBtn) {
        cancelReportDefinitionBtn.addEventListener('click', function() {
            if(addReportDefinitionModal) addReportDefinitionModal.classList.add('hidden');
        });
    }

    if (gifWithdrawDrugBtn) { // Zaktualizowana nazwa zmiennej dla przycisku GIF
        gifWithdrawDrugBtn.addEventListener('click', () => {
            if (currentRole === 'gif') {
                if(gifDecisionDateInput) gifDecisionDateInput.valueAsDate = new Date();
                if(gifDecisionForm) gifDecisionForm.reset();
                if(gifWithdrawalFormModal) gifWithdrawalFormModal.classList.remove('hidden'); // Zaktualizowana nazwa zmiennej dla modala GIF
            }
        });
    }

    if (gifDecisionForm) {
        gifDecisionForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const decisionData = {
                NazwaProduktuLeczniczego: document.getElementById('gif-product-name').value.trim(),
                Moc: document.getElementById('gif-strength').value.trim() || null,
                Postac: document.getElementById('gif-form').value.trim() || null,
                NazwaPodmiotuOdpowiedzialnego: document.getElementById('gif-mah').value.trim(),
                RodzajDecyzji: document.getElementById('gif-decision-type').value,
                DataDecyzji: document.getElementById('gif-decision-date').value,
                NumerDecyzji: document.getElementById('gif-decision-number').value.trim(),
                NumerSprawy: document.getElementById('gif-case-number').value.trim() || null,
                LinkDoPobraniaDecyzji: document.getElementById('gif-decision-link').value.trim() || null,
                Serie: null,
                ListaGTIN: null
            };

            if (!decisionData.NazwaProduktuLeczniczego || !decisionData.NazwaPodmiotuOdpowiedzialnego || !decisionData.RodzajDecyzji || !decisionData.DataDecyzji || !decisionData.NumerDecyzji) {
                alert("Proszę wypełnić wszystkie wymagane pola (Nazwa produktu, Podmiot, Rodzaj, Data, Numer Decyzji).");
                return;
            }

            const batchesInput = document.getElementById('gif-batches').value.trim();
            if (batchesInput) {
                const batchNumbers = batchesInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
                if (batchNumbers.length > 0) {
                    decisionData.Serie = { Seria: batchNumbers.map(num => ({ NumerSerii: num, DataWaznosci: null })) };
                }
            } else {
                decisionData.Serie = null;
            }

            const gtinsInput = document.getElementById('gif-gtins').value.trim();
            if (gtinsInput) {
                 const gtinValues = gtinsInput.split(/[\n,]+/).map(g => g.trim()).filter(g => g);
                 if (gtinValues.length > 0) {
                    decisionData.ListaGTIN = { GTIN: gtinValues.map(g => ({ GTIN: g, WielkoscOpakowania: null })) };
                }
            }
            // Użyj specjalnego RodzajDecyzji dla wpisów manualnych, aby odróżnić od API
            // lub zachowaj wybrany przez użytkownika, jeśli formularz ma być dokładnym odzwierciedleniem decyzji GIF
            // decisionData.RodzajDecyzji = "DECYZJA_GIF_MANUALNA"; // Jeśli chcemy specjalnie oznaczyć

             let status = '';
             let statusText = decisionData.RodzajDecyzji ? decisionData.RodzajDecyzji.replace(/_/g, ' ') : 'Nieznany';
             statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1).toLowerCase();

             if (decisionData.RodzajDecyzji === "WYCOFANIE_Z_OBROTU" || decisionData.RodzajDecyzji === "ZAKAZ_WPROWADZENIA") {
                 status = 'withdrawn';
             } else if (decisionData.RodzajDecyzji === "WSTRZYMANIE_W_OBROCIE") {
                 status = 'active';
             } else { // Domyślnie dla "DECYZJA_GIF_MANUALNA" lub innych
                 status = 'withdrawn';
             }


             let batchNumbersText = "Wszystkie";
             if (decisionData.Serie && decisionData.Serie.Seria && decisionData.Serie.Seria.length > 0) {
                 batchNumbersText = decisionData.Serie.Seria.map(s => s.NumerSerii).join(', ');
             }

             const newDecisionEntry = {
                id: decisionData.NumerDecyzji,
                name: decisionData.NazwaProduktuLeczniczego,
                batchNumber: batchNumbersText,
                withdrawalDate: decisionData.DataDecyzji,
                reason: decisionData.RodzajDecyzji.replace(/_/g, ' '),
                status: status,
                statusText: statusText,
                apiData: decisionData
            };

            processedMedicines.unshift(newDecisionEntry);
            processedMedicines.sort((a, b) => new Date(b.withdrawalDate) - new Date(a.withdrawalDate));
            loadMedicinesTable();

            mockNotifications.unshift({ id: mockNotifications.length + 1, title: `Nowa decyzja GIF: ${decisionData.NazwaProduktuLeczniczego}`, time: new Date().toLocaleString('pl-PL'), message: `Wydano decyzję: ${statusText}. Numer: ${decisionData.NumerDecyzji}` });
            loadNotifications();

            if(gifWithdrawalFormModal) gifWithdrawalFormModal.classList.add('hidden');
            alert('Decyzja GIF została dodana!');
        });
    }

    if (cancelGifDecisionBtn) {
        cancelGifDecisionBtn.addEventListener('click', () => {
            if(gifWithdrawalFormModal) gifWithdrawalFormModal.classList.add('hidden');
        });
    }

    allCloseBtns.forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) modal.classList.add('hidden');
        });
    });

    window.addEventListener('click', function(event) {
        allModals.forEach(modal => {
            if (event.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });

    if (searchLekiInput) {
        searchLekiInput.addEventListener('input', function() {
            const searchText = this.value.toLowerCase().trim();
            const tableBody = document.querySelector('#medicines-table tbody');
            if (!tableBody) return;
            const rows = tableBody.querySelectorAll('tr');

            if (rows.length === 1 && rows[0].cells.length === 1 && rows[0].cells[0].colSpan === 7) {
                return;
            }

            rows.forEach(row => {
                if (row.cells.length < 5) return;
                const idText = row.cells[0].textContent.toLowerCase();
                const nameText = row.cells[1].textContent.toLowerCase();
                const batchNumberText = row.cells[2].textContent.toLowerCase();
                const reasonText = row.cells[4].textContent.toLowerCase();
                const statusText = row.cells[5].textContent.toLowerCase();

                if (idText.includes(searchText) || nameText.includes(searchText) || batchNumberText.includes(searchText) || reasonText.includes(searchText) || statusText.includes(searchText)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }

    if(mainPanelDiv) mainPanelDiv.classList.add('hidden');
    if(loginScreenDiv) {
        loginScreenDiv.classList.add('active');
        loginScreenDiv.classList.remove('hidden');
    }
    if(gifDecisionForm) gifDecisionForm.reset();
});