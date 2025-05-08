const mockMedicines = [
    {
        id: "MED_20250401001",
        name: "Paracetamol 500mg",
        batchNumber: "LOT2025001",
        withdrawalDate: "2025-04-10",
        reason: "Zanieczyszczenie substancji aktywnej",
        status: "active"
    },
    {
        id: "MED_20250402002",
        name: "Amoksycylina 1000mg",
        batchNumber: "LOT2025002",
        withdrawalDate: "2025-04-12",
        reason: "Błąd w oznaczeniu na opakowaniu",
        status: "active"
    },
    {
        id: "MED_20250403003",
        name: "Ibuprom 200mg",
        batchNumber: "LOT2025003",
        withdrawalDate: "2025-04-08",
        reason: "Niezgodność z dokumentacją rejestracyjną",
        status: "withdrawn"
    }
];

const mockNotifications = [
    {
        id: 1,
        title: "Nowe wycofanie: Paracetamol 500mg",
        time: "2025-04-10 09:15",
        message: "Seria LOT2025001 została wycofana z powodu zanieczyszczenia substancji aktywnej."
    },
    {
        id: 2,
        title: "Nowe wycofanie: Amoksycylina 1000mg",
        time: "2025-04-12 14:30",
        message: "Seria LOT2025002 została wycofana z powodu błędu w oznaczeniu na opakowaniu."
    }
];

const mockInventory = {
    wytwórnia: [
        { id: 1, name: "Paracetamol 500mg", batchNumber: "LOT2025001", quantity: 5000 },
        { id: 2, name: "Amoksycylina 1000mg", batchNumber: "LOT2025002", quantity: 3000 },
    ],
    hurtownia: [
        { id: 1, name: "Paracetamol 500mg", batchNumber: "LOT2025001", quantity: 2000 },
        { id: 2, name: "Amoksycylina 1000mg", batchNumber: "LOT2025002", quantity: 1500 },
    ],
    apteka: [
        { id: 1, name: "Paracetamol 500mg", batchNumber: "LOT2025001", quantity: 200 },
        { id: 2, name: "Amoksycylina 1000mg", batchNumber: "LOT2025002", quantity: 150 },
    ],
    gif: [] // GIF Inspector might not have direct inventory
};

// NOWA ZMIENNA GLOBALNA: Definicje raportów
let mockReportDefinitions = [
    { id: 'rep_def_1', name: "Raport wycofanych leków (ostatnie 30 dni)", description: "Generuje listę leków wycofanych w ciągu ostatnich 30 dni." },
    { id: 'rep_def_2', name: "Raport statusu odpowiedzi hurtowni", description: "Pokazuje status odpowiedzi od hurtowni na zgłoszenia wycofania." },
    { id: 'rep_def_3', name: "Raport statusu odpowiedzi aptek", description: "Pokazuje status odpowiedzi od aptek na zgłoszenia wycofania." },
    { id: 'rep_def_4', name: "Zestawienie zbiorcze wycofań", description: "Ogólne zestawienie wszystkich operacji wycofania leków." }
];


// Globalne zmienne aplikacji
let currentUser = null;
let currentRole = null;

// Funkcje pomocnicze
function formatDate(dateString) {
    if (!dateString) return 'Brak danych';
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    try {
        return new Date(dateString).toLocaleDateString('pl-PL', options);
    } catch (e) {
        return dateString; // Zwróć oryginalny string jeśli data jest nieprawidłowa
    }
}

// Tłumaczenia ról dla UI
const roleTranslations = {
    'wytwórnia': 'Wytwórnia',
    'hurtownia': 'Hurtownia',
    'apteka': 'Apteka',
    'gif': 'GIF Inspektor'
};

// Funkcja do pobierania i przetwarzania danych z API
async function fetchDataAndInitialize() {
    try {
        const response = await fetch('http://localhost:8000/drugs');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const apiJson = await response.json();
        processGifData(apiJson); // Przetwarzanie danych i zapisanie do processedMedicines
        loadMedicinesTable(); // Załadowanie tabeli z przetworzonymi danymi
        // Można tu również odświeżyć inne zależne komponenty, np. powiadomienia
    } catch (error) {
        console.error("Nie udało się pobrać lub przetworzyć danych o lekach:", error);
        alert("Wystąpił błąd podczas ładowania danych o lekach. Sprawdź konsolę, aby uzyskać więcej informacji.");
        // Opcjonalnie: załaduj tabelę z pustymi danymi lub komunikatem o błędzie
        processedMedicines = [];
        loadMedicinesTable();
    }
}

function processGifData(apiJson) {
    if (!apiJson || !apiJson.Decyzje || !Array.isArray(apiJson.Decyzje.Decyzja)) {
        console.error("Otrzymano nieprawidłowy format danych z API.");
        processedMedicines = [];
        return;
    }

    const decyzje = apiJson.Decyzje.Decyzja;
    processedMedicines = decyzje
        .filter(decyzja => {
            // Filtrujemy decyzje, które nie są typowym wycofaniem/zakazem/wstrzymaniem
            // np. ponowne dopuszczenie do obrotu lub wstrzymanie reklam
            return ["WYCOFANIE_Z_OBROTU", "ZAKAZ_WPROWADZENIA", "WSTRZYMANIE_W_OBROCIE"].includes(decyzja.RodzajDecyzji);
        })
        .map(decyzja => {
            let status = '';
            let statusText = decyzja.RodzajDecyzji.replace(/_/g, ' ').toLowerCase();
            statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1); // Kapitalizacja

            if (decyzja.RodzajDecyzji === "WYCOFANIE_Z_OBROTU" || decyzja.RodzajDecyzji === "ZAKAZ_WPROWADZENIA") {
                status = 'withdrawn';
            } else if (decyzja.RodzajDecyzji === "WSTRZYMANIE_W_OBROCIE") {
                status = 'active'; // 'active' dla CSS, tekst będzie "Wstrzymanie w obrocie"
            }

            let batchNumbers = "Nie dotyczy";
            if (decyzja.Serie && decyzja.Serie.Seria) {
                const serieArray = Array.isArray(decyzja.Serie.Seria) ? decyzja.Serie.Seria : [decyzja.Serie.Seria];
                batchNumbers = serieArray.map(s => s.NumerSerii).join(', ') || "Nie dotyczy";
            }

            const idParts = decyzja.LinkDoPobraniaDecyzji ? decyzja.LinkDoPobraniaDecyzji.split('/') : [];
            const decisionId = idParts.length > 0 ? idParts[idParts.length -1] : decyzja.NumerDecyzji || `DEC_${Date.now()}_${Math.random()}`;

            return {
                id: decisionId,
                name: decyzja.NazwaProduktuLeczniczego || "Brak nazwy",
                batchNumber: batchNumbers,
                withdrawalDate: decyzja.DataDecyzji,
                reason: decyzja.RodzajDecyzji.replace(/_/g, ' '), // Bardziej czytelna przyczyna
                status: status,
                statusText: statusText,
                apiData: decyzja // Przechowujemy oryginalne dane
            };
        });
}


// Obsługa logowania
document.getElementById('login-btn').addEventListener('click', async function() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    if (!username || !password || !role) {
        alert('Proszę wypełnić wszystkie pola!');
        return;
    }

    currentUser = username;
    currentRole = role;

    document.getElementById('logged-user').textContent = username;
    document.getElementById('user-role').textContent = roleTranslations[role] || role;

    document.querySelectorAll('.hidden-role').forEach(el => {
        if (el.dataset.visibleFor === role) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-panel').classList.remove('hidden');

    await fetchDataAndInitialize(); // Pobierz i przetwórz dane po zalogowaniu

    loadNotifications();
    loadInventory();
    loadReports();
});

// Obsługa wylogowania
document.getElementById('logout-btn').addEventListener('click', function() {
    currentUser = null;
    currentRole = null;
    processedMedicines = []; // Wyczyść dane po wylogowaniu

    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('role').value = '';

    document.getElementById('main-panel').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('active');

    // Wyczyść tabelę leków
    const tableBody = document.querySelector('#medicines-table tbody');
    if (tableBody) tableBody.innerHTML = '';
});


// Obsługa nawigacji
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        this.classList.add('active');

        const targetSection = this.dataset.tab;
        document.querySelectorAll('.panel-section').forEach(section => {
            section.classList.remove('active');
            section.classList.add('hidden');
        });
        const activeSection = document.getElementById(targetSection);
        activeSection.classList.add('active');
        activeSection.classList.remove('hidden');

        if (targetSection === 'raporty') {
            loadReports();
        }
         if (targetSection === 'wycofane-leki' && processedMedicines.length > 0) {
            loadMedicinesTable(); // Przeładuj tabelę, jeśli dane są dostępne
        }
    });
});

// Ładowanie danych do tabeli leków
function loadMedicinesTable() {
    const tableBody = document.querySelector('#medicines-table tbody');
    if (!tableBody) {
        console.error("Nie znaleziono tbody tabeli leków!");
        return;
    }
    tableBody.innerHTML = '';

    if (processedMedicines.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Brak danych o wycofanych lekach lub dane nie zostały jeszcze załadowane.</td></tr>';
        return;
    }

    processedMedicines.forEach(medicine => {
        const row = document.createElement('tr');
        // Używamy medicine.statusText dla wyświetlanego tekstu statusu
        // Używamy medicine.status ('active'/'withdrawn') dla klasy CSS
        const statusClass = medicine.status === 'active' ? 'status-active' : (medicine.status === 'withdrawn' ? 'status-withdrawn' : 'status-unknown');
        const displayedStatusText = medicine.statusText || (medicine.status === 'active' ? 'Aktywny' : (medicine.status === 'withdrawn' ? 'Wycofany' : 'Nieznany'));


        row.innerHTML = `
            <td>${medicine.id}</td>
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
                <button class="report-btn" data-id="${medicine.id}"><i class="fas fa-file-alt"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            showMedicineDetails(this.dataset.id);
        });
    });

    document.querySelectorAll('.report-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            alert(`Generowanie raportu dla produktu ${this.dataset.id}... (Logika niezaimplementowana)`);
        });
    });
}

// Wyświetlanie szczegółów leku
function showMedicineDetails(medicineId) {
    const medicine = processedMedicines.find(m => String(m.id) === String(medicineId));
    if (!medicine || !medicine.apiData) {
        console.error("Nie znaleziono leku lub brak danych API dla ID:", medicineId);
        document.getElementById('medicine-details-content').innerHTML = '<p>Nie znaleziono szczegółów dla tego leku.</p>';
        document.getElementById('medicine-details-modal').classList.remove('hidden');
        return;
    }

    const details = medicine.apiData;
    const statusClass = medicine.status === 'active' ? 'status-active' : (medicine.status === 'withdrawn' ? 'status-withdrawn' : 'status-unknown');
    const displayedStatusText = medicine.statusText || (medicine.status === 'active' ? 'Aktywny' : (medicine.status === 'withdrawn' ? 'Wycofany' : 'Nieznany'));

    let serieInfo = "Brak danych o seriach";
    if (details.Serie && details.Serie.Seria) {
        const serieArray = Array.isArray(details.Serie.Seria) ? details.Serie.Seria : [details.Serie.Seria];
        serieInfo = '<ul>';
        serieArray.forEach(s => {
            serieInfo += `<li>Numer: ${s.NumerSerii || 'Brak'}, Data ważności: ${formatDate(s.DataWaznosci) || 'Brak'}</li>`;
        });
        serieInfo += '</ul>';
    }

    let gtinInfo = "Brak danych GTIN";
    if (details.ListaGTIN && details.ListaGTIN.GTIN) {
        const gtinArray = Array.isArray(details.ListaGTIN.GTIN) ? details.ListaGTIN.GTIN : [details.ListaGTIN.GTIN];
        gtinInfo = '<ul>';
        gtinArray.forEach(g => {
            gtinInfo += `<li>GTIN: ${g.GTIN || 'Brak'}, Wielkość opakowania: ${g.WielkoscOpakowania || 'Brak'}</li>`;
        });
        gtinInfo += '</ul>';
    }


    const detailsContent = document.getElementById('medicine-details-content');
    detailsContent.innerHTML = `
        <div class="medicine-details">
            <p><strong>ID Decyzji (Link):</strong> <a href="${details.LinkDoPobraniaDecyzji || '#'}" target="_blank">${medicine.id}</a></p>
            <p><strong>Nazwa Produktu Leczniczego:</strong> ${details.NazwaProduktuLeczniczego || 'Brak danych'}</p>
            <p><strong>Moc:</strong> ${details.Moc || 'Brak danych'}</p>
            <p><strong>Postać:</strong> ${details.Postac || 'Brak danych'}</p>
            <p><strong>Podmiot Odpowiedzialny:</strong> ${details.NazwaPodmiotuOdpowiedzialnego || 'Brak danych'}</p>
            <hr>
            <p><strong>Data Decyzji:</strong> ${formatDate(details.DataDecyzji)}</p>
            <p><strong>Rodzaj Decyzji:</strong> ${details.RodzajDecyzji ? details.RodzajDecyzji.replace(/_/g, ' ') : 'Brak danych'}</p>
            <p><strong>Numer Decyzji:</strong> ${details.NumerDecyzji || 'Brak danych'}</p>
            <p><strong>Numer Sprawy:</strong> ${details.NumerSprawy || 'Brak danych'}</p>
            <hr>
            <p><strong>Status w systemie:</strong>
                <span class="status-badge ${statusClass}">
                    ${displayedStatusText}
                </span>
            </p>
            <h4>Serie Produktu:</h4>
            ${serieInfo}
            <h4>Lista GTIN:</h4>
            ${gtinInfo}
            <div class="distribution-info">
                <h4>Informacje o dystrybucji (przykładowe):</h4>
                <ul>
                    <li>Wytwórnia: (dane przykładowe)</li>
                    <li>Hurtownie: (dane przykładowe)</li>
                    <li>Apteki: (dane przykładowe)</li>
                </ul>
            </div>
        </div>
    `;
    document.getElementById('medicine-details-modal').classList.remove('hidden');
}

// Ładowanie powiadomień
function loadNotifications() {
    const container = document.querySelector('.notifications-container');
    container.innerHTML = ''; // Wyczyść istniejące
    if (mockNotifications.length === 0) { // Używamy mockNotifications, można to zmienić na dynamiczne
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

// Ładowanie danych inwentarza
function loadInventory() {
    const container = document.querySelector('.inventory-container');
    container.innerHTML = ''; // Wyczyść istniejące
    if (!currentRole || !mockInventory[currentRole] || mockInventory[currentRole].length === 0) {
        container.innerHTML = '<p class="empty-message">Brak danych inwentarza dla tej roli.</p>';
        return;
    }
    const inventory = mockInventory[currentRole]; // Używamy mockInventory
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>ID</th>
                <th>Nazwa leku</th>
                <th>Numer serii</th>
                <th>Ilość</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${inventory.map(item => `
                <tr>
                    <td>${item.id}</td>
                    <td>${item.name}</td>
                    <td>${item.batchNumber}</td>
                    <td>${item.quantity} szt.</td>
                    <td><span class="status-badge status-active">Aktywny</span></td>
                </tr>
            `).join('')}
        </tbody>
    `;
    container.appendChild(table);
}

// Ładowanie raportów
function loadReports() {
    const container = document.querySelector('.reports-container');
    container.innerHTML = ''; // Wyczyść poprzednią zawartość

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


// Obsługa modalu dodawania nowego wycofania
document.getElementById('add-withdrawal-btn')?.addEventListener('click', function() {
    document.getElementById('add-withdrawal-modal').classList.remove('hidden');
});

document.getElementById('submit-withdrawal')?.addEventListener('click', function() {
    const productName = document.getElementById('product-name').value;
    const batchNumber = document.getElementById('batch-number').value;
    const reasonInput = document.getElementById('withdrawal-reason').value; // To będzie opisowa przyczyna od użytkownika

    if (!productName || !batchNumber || !reasonInput) {
        alert('Proszę wypełnić wszystkie pola!');
        return;
    }
    // Przy dodawaniu ręcznym, `RodzajDecyzji` będzie np. "WYCOFANIE INICJOWANE PRZEZ UŻYTKOWNIKA"
    // lub można dodać pole wyboru rodzaju decyzji. Dla uproszczenia:
    const rodzajDecyzjiManual = "WYCOFANIE MANUALNE";

    const newMedicineApiData = { // Tworzymy obiekt podobny do API dla spójności
        NazwaProduktuLeczniczego: productName,
        Serie: { Seria: [{ NumerSerii: batchNumber, DataWaznosci: null }] }, // Uproszczone
        DataDecyzji: new Date().toISOString().split('T')[0],
        RodzajDecyzji: rodzajDecyzjiManual,
        Moc: "N/A",
        Postac: "N/A",
        NazwaPodmiotuOdpowiedzialnego: "Wprowadzone przez: " + currentUser,
        LinkDoPobraniaDecyzji: "#local_" + Date.now(),
        NumerDecyzji: "LOKALNE/" + Date.now().toString().substring(8),
        NumerSprawy: "LOKALNE"
    };

    const newProcessedMedicine = {
        id: newMedicineApiData.LinkDoPobraniaDecyzji.split('_')[1],
        name: productName,
        batchNumber: batchNumber,
        withdrawalDate: newMedicineApiData.DataDecyzji,
        reason: rodzajDecyzjiManual + " (" + reasonInput + ")", // Łączymy rodzaj z opisem użytkownika
        status: 'withdrawn', // Domyślnie wycofane
        statusText: 'Wycofanie manualne',
        apiData: newMedicineApiData
    };

    processedMedicines.unshift(newProcessedMedicine);
    loadMedicinesTable();

    // Dodaj powiadomienie - można rozbudować
    mockNotifications.unshift({
        id: mockNotifications.length + 1,
        title: `Nowe wycofanie (manualne): ${productName}`,
        time: new Date().toLocaleString('pl-PL'),
        message: `Seria ${batchNumber} została wycofana. Przyczyna: ${reasonInput}.`
    });
    loadNotifications(); // Odśwież powiadomienia

    document.getElementById('add-withdrawal-modal').classList.add('hidden');
    document.getElementById('product-name').value = '';
    document.getElementById('batch-number').value = '';
    document.getElementById('withdrawal-reason').value = '';
    alert('Wycofanie zostało dodane lokalnie!');
});

document.getElementById('cancel-withdrawal')?.addEventListener('click', function() {
    document.getElementById('add-withdrawal-modal').classList.add('hidden');
});


// Obsługa modalu dodawania nowej definicji raportu
const addReportDefinitionBtn = document.getElementById('add-report-definition-btn');
const addReportDefinitionModal = document.getElementById('add-report-definition-modal');
const submitReportDefinitionBtn = document.getElementById('submit-report-definition');
const cancelReportDefinitionBtn = document.getElementById('cancel-report-definition');
const reportDefNameInput = document.getElementById('report-definition-name');
const reportDefDescInput = document.getElementById('report-definition-description');

if (addReportDefinitionBtn) {
    addReportDefinitionBtn.addEventListener('click', function() {
        if (currentRole === 'gif') {
            reportDefNameInput.value = '';
            reportDefDescInput.value = '';
            addReportDefinitionModal.classList.remove('hidden');
        }
    });
}

if (submitReportDefinitionBtn) {
    submitReportDefinitionBtn.addEventListener('click', function() {
        const reportName = reportDefNameInput.value.trim();
        const reportDescription = reportDefDescInput.value.trim();

        if (!reportName) {
            alert('Nazwa raportu jest wymagana!');
            return;
        }

        const newReportDef = {
            id: `rep_def_${Date.now().toString().substring(6)}`,
            name: reportName,
            description: reportDescription
        };
        mockReportDefinitions.push(newReportDef);

        loadReports();
        addReportDefinitionModal.classList.add('hidden');
        alert('Definicja raportu została dodana!');
    });
}

if (cancelReportDefinitionBtn) {
    cancelReportDefinitionBtn.addEventListener('click', function() {
        addReportDefinitionModal.classList.add('hidden');
    });
}

// Obsługa zamykania modali
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
        this.closest('.modal').classList.add('hidden');
    });
});

window.addEventListener('click', function(event) {
    document.querySelectorAll('.modal').forEach(modal => {
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    });
});

// Wyszukiwanie w tabeli leków
document.getElementById('search-leki').addEventListener('input', function() {
    const searchText = this.value.toLowerCase().trim();
    const rows = document.querySelectorAll('#medicines-table tbody tr');

    if (rows.length === 1 && rows[0].textContent.includes("Brak danych")) { // Sprawdzenie czy jest tylko wiersz "Brak danych"
        return;
    }

    rows.forEach(row => {
        // Sprawdzamy, czy wiersz zawiera komórki danych (nie jest to np. wiersz "Brak danych")
        if (row.cells.length < 3) return; // Minimalna liczba komórek do przeszukania (ID, Nazwa, Numer Serii)

        const idText = row.cells[0].textContent.toLowerCase();
        const nameText = row.cells[1].textContent.toLowerCase();
        const batchNumberText = row.cells[2].textContent.toLowerCase();
        const reasonText = row.cells[4].textContent.toLowerCase(); // Dodano przeszukiwanie po przyczynie

        if (idText.includes(searchText) ||
            nameText.includes(searchText) ||
            batchNumberText.includes(searchText) ||
            reasonText.includes(searchText)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});

// Początkowe ukrycie panelu głównego, pokazanie logowania
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('main-panel').classList.add('hidden');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-screen').classList.remove('hidden');
});