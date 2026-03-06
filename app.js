// DOM Elements
const configAlert = document.getElementById('config-alert');
const btnAlertConfigure = document.getElementById('btn-alert-configure');
const btnSettingsNav = document.getElementById('btn-settings-nav');

const clientsTableBody = document.getElementById('clients-table-body');
const searchInput = document.getElementById('search-input');
const btnAddClient = document.getElementById('btn-add-client');

const addClientModal = document.getElementById('add-client-modal');
const settingsModal = document.getElementById('settings-modal');
const closeModals = document.querySelectorAll('.close-modal');

// Config Elements
const configToken = document.getElementById('config-token');
const configOwner = document.getElementById('config-owner');
const configRepo = document.getElementById('config-repo');
const configPath = document.getElementById('config-path');
const btnSaveConfig = document.getElementById('btn-save-config');
const btnTestConnection = document.getElementById('btn-test-connection');

// Add Client Elements
const newClientName = document.getElementById('new-client-name');
const newClientCode = document.getElementById('new-client-code');
const newClientStatus = document.getElementById('new-client-status');
const btnGenerateCode = document.getElementById('btn-generate-code');
const btnSaveClient = document.getElementById('btn-save-client');

// Global State
const DEFAULT_CONFIG = {
    token: '',
    owner: 'sehilinnovation',
    repo: 'mandhi-shop-licensing',
    path: 'clients.json'
};

// Helper to get from localStorage or fallback if empty
function getConfig(key) {
    const val = localStorage.getItem('gh_' + key);
    return (val && val.trim() !== '') ? val : DEFAULT_CONFIG[key];
}

let config = {
    token: getConfig('token'),
    owner: getConfig('owner'),
    repo: getConfig('repo'),
    path: getConfig('path')
};

let clientsData = { clients: [] };
let fileSha = ''; // Needed for updating GitHub files

// Initialize Application
function init() {
    // Populate Config Modal inputs for user to see
    configToken.value = config.token;
    configOwner.value = config.owner;
    configRepo.value = config.repo;
    configPath.value = config.path;

    // Check if configuration exists
    if (!config.token || !config.owner || !config.repo || !config.path) {
        configAlert.style.display = 'flex';
        renderEmptyState('Please configure your GitHub connection to load clients.');
    } else {
        configAlert.style.display = 'none';
        fetchClients();
    }
}

// GitHub API Fetch Helpers
async function fetchFromGitHub() {
    // Prevent fetching if token is empty to avoid generic network errors
    if (!config.token || config.token.trim() === '') {
        throw new Error("Configuration Missing: Please enter your GitHub Personal Access Token in Settings.");
    }

    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}?t=${Date.now()}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("clients.json file not found in repository.");
            }
            if (response.status === 401) {
                throw new Error("401 Unauthorized: Your token is invalid or has been revoked.");
            }
            throw new Error(`GitHub API Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (err) {
        // Check for specific browser-level network/CORS failure messages
        const errMsg = err.message ? err.message.toLowerCase() : "";
        const isNetworkError =
            (err.name === 'TypeError') ||
            errMsg.includes('networkerror') ||
            errMsg.includes('failed to fetch');

        if (isNetworkError && !errMsg.includes("unauthorized") && !errMsg.includes("not found")) {
            throw new Error("Network/Security Error: Connection to GitHub was blocked. Please check your internet or disable Ad-blockers.");
        }
        throw err;
    }
}

async function updateGitHubFile(newContent, message) {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;

    // Base64 encode the content, handle unicode correctly
    const b64encoded = btoa(unescape(encodeURIComponent(JSON.stringify(newContent, null, 2))));

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message,
            content: b64encoded,
            sha: fileSha
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to update GitHub: ${response.statusText}`);
    }

    const data = await response.json();
    fileSha = data.content.sha; // Update SHA for future commits
    return data;
}

// Business Logic
async function fetchClients() {
    try {
        clientsTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-20"><i class="bx bx-loader-alt bx-spin mr-10" style="vertical-align: middle;"></i> Fetching clients securely from GitHub...</td></tr>';

        const data = await fetchFromGitHub();
        fileSha = data.sha;

        // Decode base64 content
        const decodedContent = decodeURIComponent(escape(atob(data.content)));
        clientsData = JSON.parse(decodedContent);

        // Ensure structure
        if (!clientsData.clients) {
            clientsData.clients = [];
        }

        renderClients(clientsData.clients);
        updateStats();

    } catch (error) {
        console.error("Fetch Error:", error);

        if (error.message.includes('not found')) {
            clientsData = { clients: [] };
            fileSha = '';
            renderEmptyState("File clients.json not found on GitHub. Click 'Add New Client' to create your database!");
            updateStats();
        } else {
            let userMessage = error.message;
            if (error.message.includes("Network Error")) {
                userMessage = "Network/Security Error: Browser blocked the request. Try refreshing (F5) or use it in Microsoft Edge/Firefox if Chrome fails.";
            }

            renderEmptyState(`<i class='bx bx-error-circle'></i> ${userMessage}`);
            showToast(userMessage, 'error');
            configAlert.style.display = 'flex';
            configAlert.querySelector('span').textContent = `Status: ${userMessage}`;
        }
    }
}

// Rendering
function renderClients(clientsList) {
    if (clientsList.length === 0) {
        renderEmptyState("No active clients found. Click 'Add New Client' to get started.");
        return;
    }

    clientsTableBody.innerHTML = '';

    clientsList.forEach((client, index) => {
        const tr = document.createElement('tr');

        const isChecked = client.status === 'active' ? 'checked' : '';
        const statusBadgeClass = client.status === 'active' ? 'active' : 'inactive';
        const statusText = client.status === 'active' ? 'Accessible' : 'Locked';

        tr.innerHTML = `
            <td>
                <div style="font-weight: 600;">${client.name}</div>
                <small class="text-muted">Added: ${client.dateAdded || 'Unknown'}</small>
            </td>
            <td>
                <span class="code-badge">${client.secretCode}</span>
            </td>
            <td>
                <span class="status ${statusBadgeClass}">${statusText}</span>
            </td>
            <td>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <label class="switch">
                        <input type="checkbox" onchange="toggleClientStatus('${client.secretCode}')" ${isChecked}>
                        <span class="slider"></span>
                    </label>
                    <button class="icon-btn icon-danger" onclick="deleteClient('${client.secretCode}')" title="Delete Client">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            </td>
        `;
        clientsTableBody.appendChild(tr);
    });
}

function renderEmptyState(message) {
    clientsTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-20">${message}</td></tr>`;
}

function updateStats() {
    const total = clientsData.clients.length;
    const active = clientsData.clients.filter(c => c.status === 'active').length;
    const inactive = total - active;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-inactive').textContent = inactive;
}

// Actions
window.toggleClientStatus = async function (secretCode) {
    const client = clientsData.clients.find(c => c.secretCode === secretCode);
    if (!client) return;

    // Toggle status locally
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    client.status = newStatus;

    // Optimistic UI Update
    renderClients(clientsData.clients);
    updateStats();

    try {
        await updateGitHubFile(clientsData, `Toggle status for ${client.name} to ${newStatus}`);
        showToast(`Client ${client.name} is now ${newStatus}.`, 'success');
    } catch (error) {
        console.error(error);
        // Revert UI on failure
        client.status = newStatus === 'active' ? 'inactive' : 'active';
        renderClients(clientsData.clients);
        updateStats();
        showToast('Failed to update GitHub database.', 'error');
    }
}

window.deleteClient = async function (secretCode) {
    if (!confirm('Are you sure you want to permanently delete this client? They will be locked out of their POS app.')) return;

    const clientName = clientsData.clients.find(c => c.secretCode === secretCode)?.name || 'Unknown';
    clientsData.clients = clientsData.clients.filter(c => c.secretCode !== secretCode);

    // Optimistic UI Update
    renderClients(clientsData.clients);
    updateStats();

    try {
        await updateGitHubFile(clientsData, `Deleted client ${clientName}`);
        showToast(`Client deleted successfully.`, 'success');
    } catch (error) {
        console.error(error);
        showToast('Failed to delete on GitHub. Refresh to sync.', 'error');
        fetchClients(); // Re-sync
    }
}

// Event Listeners
btnAlertConfigure.addEventListener('click', () => { settingsModal.classList.add('active'); });
btnSettingsNav.addEventListener('click', (e) => { e.preventDefault(); settingsModal.classList.add('active'); });
btnAddClient.addEventListener('click', () => {
    newClientName.value = '';
    newClientCode.value = '';
    newClientStatus.value = 'active';
    addClientModal.classList.add('active');
});

closeModals.forEach(btn => {
    btn.addEventListener('click', () => {
        addClientModal.classList.remove('active');
        settingsModal.classList.remove('active');
    });
});

// Config Settings Logic
btnSaveConfig.addEventListener('click', () => {
    const token = configToken.value.trim();
    const owner = configOwner.value.trim();
    const repo = configRepo.value.trim();
    const path = configPath.value.trim();

    if (!token || !owner || !repo || !path) {
        showToast('All configuration fields are required.', 'error');
        return;
    }

    localStorage.setItem('gh_token', token);
    localStorage.setItem('gh_owner', owner);
    localStorage.setItem('gh_repo', repo);
    localStorage.setItem('gh_path', path);

    config = { token, owner, repo, path };

    settingsModal.classList.remove('active');
    configAlert.style.display = 'none';
    showToast('Configuration saved successfully.', 'success');

    fetchClients();
});

btnTestConnection.addEventListener('click', async () => {
    const originalBtnText = btnTestConnection.innerHTML;
    btnTestConnection.disabled = true;
    btnTestConnection.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Testing...';

    const tempToken = configToken.value.trim();
    if (!tempToken) {
        showToast('Please enter a Personal Access Token first.', 'error');
        btnTestConnection.disabled = false;
        btnTestConnection.innerHTML = originalBtnText;
        return;
    }

    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${tempToken}` }
        });

        if (response.ok) {
            const user = await response.json();
            showToast(`Connection successful! Hello, ${user.login}.`, 'success');
        } else {
            showToast('Invalid Token or insufficient permissions.', 'error');
        }
    } catch (e) {
        showToast('Network error while testing connection.', 'error');
    } finally {
        btnTestConnection.disabled = false;
        btnTestConnection.innerHTML = originalBtnText;
    }
});

// Add Client Logic
btnGenerateCode.addEventListener('click', () => {
    // Generate random 6 digit code
    const val = Math.floor(100000 + Math.random() * 900000);
    newClientCode.value = val;
});

btnSaveClient.addEventListener('click', async () => {
    const name = newClientName.value.trim();
    const code = newClientCode.value.trim();
    const status = newClientStatus.value;

    if (!name || code.length !== 6) {
        showToast('Please provide a valid name and a 6-digit code.', 'error');
        return;
    }

    if (clientsData.clients.some(c => c.secretCode === code)) {
        showToast('This Secret Code is already assigned to a client. Generate a new one.', 'error');
        return;
    }

    const originalBtnText = btnSaveClient.innerText;
    btnSaveClient.disabled = true;
    btnSaveClient.innerText = 'Pushing to GitHub...';

    const newClient = {
        name: name,
        secretCode: code,
        status: status,
        dateAdded: new Date().toLocaleDateString()
    };

    clientsData.clients.push(newClient);

    try {
        await updateGitHubFile(clientsData, `Added new client: ${name}`);
        showToast(`Client ${name} registered successfully.`, 'success');
        addClientModal.classList.remove('active');
        fetchClients(); // Re-sync entirely to get new SHA
    } catch (e) {
        console.error(e);
        // Rollback
        clientsData.clients.pop();
        showToast('Failed to add client. Check your connection or GitHub Token permissions.', 'error');
    } finally {
        btnSaveClient.disabled = false;
        btnSaveClient.innerText = originalBtnText;
    }
});

// Search functionality
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = clientsData.clients.filter(c =>
        c.name.toLowerCase().includes(term) || c.secretCode.includes(term)
    );
    renderClients(filtered);
});

// Toast System Shared with App
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Icon based on type
    let iconClass = 'bx bx-check-circle';
    if (type === 'error') iconClass = 'bx bx-x-circle';

    toast.innerHTML = `<i class='${iconClass}'></i> <span>${message}</span>`;
    container.appendChild(toast);

    // Animation
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; }, 10);

    // Remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Start
init();
