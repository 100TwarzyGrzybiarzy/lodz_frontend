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
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('pl-PL', options);
}

// Tłumaczenia ról dla UI
const roleTranslations = {
    'wytwórnia': 'Wytwórnia',
    'hurtownia': 'Hurtownia',
    'apteka': 'Apteka',
    'gif': 'GIF Inspektor' // NOWE TŁUMACZENIE
};

// Obsługa logowania
document.getElementById('login-btn').addEventListener('click', function() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value; // W rzeczywistości hasło byłoby weryfikowane
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

    loadMedicinesTable();
    loadNotifications();
    loadInventory();
    loadReports(); // Załaduj raporty po zalogowaniu
});

// Obsługa wylogowania
document.getElementById('logout-btn').addEventListener('click', function() {
    currentUser = null;
    currentRole = null;

    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('role').value = '';

    document.getElementById('main-panel').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('active');
});


// Obsługa nawigacji
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        this.classList.add('active');

        const targetSection = this.dataset.tab;
        document.querySelectorAll('.panel-section').forEach(section => {
            section.classList.remove('active');
            section.classList.add('hidden'); // Upewnij się, że wszystkie są ukryte
        });
        const activeSection = document.getElementById(targetSection);
        activeSection.classList.add('active');
        activeSection.classList.remove('hidden');


        // Specjalne ładowanie dla raportów, gdy zakładka jest aktywowana
        if (targetSection === 'raporty') {
            loadReports();
        }
    });
});

// Ładowanie danych do tabeli leków
function loadMedicinesTable() {
    const tableBody = document.querySelector('#medicines-table tbody');
    tableBody.innerHTML = '';

    mockMedicines.forEach(medicine => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${medicine.id}</td>
            <td>${medicine.name}</td>
            <td>${medicine.batchNumber}</td>
            <td>${formatDate(medicine.withdrawalDate)}</td>
            <td>${medicine.reason}</td>
            <td>
                <span class="status-badge ${medicine.status === 'active' ? 'status-active' : 'status-withdrawn'}">
                    ${medicine.status === 'active' ? 'Aktywny' : 'Wycofany'}
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
    const medicine = mockMedicines.find(m => m.id === medicineId);
    if (!medicine) return;

    const detailsContent = document.getElementById('medicine-details-content');
    detailsContent.innerHTML = `
        <div class="medicine-details">
            <p><strong>ID produktu:</strong> ${medicine.id}</p>
            <p><strong>Nazwa leku:</strong> ${medicine.name}</p>
            <p><strong>Numer serii:</strong> ${medicine.batchNumber}</p>
            <p><strong>Data wycofania:</strong> ${formatDate(medicine.withdrawalDate)}</p>
            <p><strong>Przyczyna wycofania:</strong> ${medicine.reason}</p>
            <p><strong>Status:</strong> 
                <span class="status-badge ${medicine.status === 'active' ? 'status-active' : 'status-withdrawn'}">
                    ${medicine.status === 'active' ? 'Aktywny' : 'Wycofany'}
                </span>
            </p>
            <div class="distribution-info">
                <h4>Informacje o dystrybucji:</h4>
                <ul>
                    <li>Wytwórnia: 5000 szt.</li>
                    <li>Hurtownie: 3000 szt.</li>
                    <li>Apteki: 2000 szt.</li>
                </ul>
            </div>
        </div>
    `;
    document.getElementById('medicine-details-modal').classList.remove('hidden');
}

// Ładowanie powiadomień
function loadNotifications() {
    const container = document.querySelector('.notifications-container');
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

// Ładowanie danych inwentarza
function loadInventory() {
    const container = document.querySelector('.inventory-container');
    container.innerHTML = '';
    if (!currentRole || !mockInventory[currentRole] || mockInventory[currentRole].length === 0) {
        container.innerHTML = '<p class="empty-message">Brak danych inwentarza dla tej roli.</p>';
        return;
    }
    const inventory = mockInventory[currentRole];
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

// ZMODYFIKOWANA FUNKCJA: Ładowanie raportów
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
                    loadReports(); // Odśwież listę raportów
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
    const reason = document.getElementById('withdrawal-reason').value;

    if (!productName || !batchNumber || !reason) {
        alert('Proszę wypełnić wszystkie pola!');
        return;
    }

    const newMedicine = {
        id: `MED_${Date.now().toString().substring(6)}`,
        name: productName,
        batchNumber: batchNumber,
        withdrawalDate: new Date().toISOString().split('T')[0],
        reason: reason,
        status: 'active'
    };
    mockMedicines.unshift(newMedicine);
    loadMedicinesTable();

    mockNotifications.unshift({
        id: mockNotifications.length + 1,
        title: `Nowe wycofanie: ${productName}`,
        time: new Date().toLocaleString('pl-PL'),
        message: `Seria ${batchNumber} została wycofana z powodu: ${reason}.`
    });
    loadNotifications();

    document.getElementById('add-withdrawal-modal').classList.add('hidden');
    document.getElementById('product-name').value = '';
    document.getElementById('batch-number').value = '';
    document.getElementById('withdrawal-reason').value = '';
    alert('Wycofanie zostało dodane!');
});

document.getElementById('cancel-withdrawal')?.addEventListener('click', function() {
    document.getElementById('add-withdrawal-modal').classList.add('hidden');
});


// NOWA SEKCJA: Obsługa modalu dodawania nowej definicji raportu
const addReportDefinitionBtn = document.getElementById('add-report-definition-btn');
const addReportDefinitionModal = document.getElementById('add-report-definition-modal');
const submitReportDefinitionBtn = document.getElementById('submit-report-definition');
const cancelReportDefinitionBtn = document.getElementById('cancel-report-definition');
const reportDefNameInput = document.getElementById('report-definition-name');
const reportDefDescInput = document.getElementById('report-definition-description');

if (addReportDefinitionBtn) {
    addReportDefinitionBtn.addEventListener('click', function() {
        if (currentRole === 'gif') { // Dodatkowe sprawdzenie, choć przycisk jest warunkowo pokazywany
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

        loadReports(); // Odśwież listę raportów w UI
        addReportDefinitionModal.classList.add('hidden');
        alert('Definicja raportu została dodana!');
    });
}

if (cancelReportDefinitionBtn) {
    cancelReportDefinitionBtn.addEventListener('click', function() {
        addReportDefinitionModal.classList.add('hidden');
    });
}

// Obsługa zamykania modali (ogólna)
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


document.getElementById('search-leki').addEventListener('input', function() {
    const searchText = this.value.toLowerCase();
    const rows = document.querySelectorAll('#medicines-table tbody tr');
    rows.forEach(row => {
        const name = row.children[1].textContent.toLowerCase();
        const batchNumber = row.children[2].textContent.toLowerCase();
        if (name.includes(searchText) || batchNumber.includes(searchText)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});

