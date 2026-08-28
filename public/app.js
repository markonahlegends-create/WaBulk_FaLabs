const API_BASE = '/api';
const AUTH_TOKEN = 'change_me_in_production';

function showTab(tabName, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(`tab-${tabName}`).classList.add('active');
    if (btnElement) {
        btnElement.classList.add('active');
    }
}

window.showTab = showTab;

function previewImage(inputId, previewId) {
    const url = document.getElementById(inputId).value;
    const preview = document.getElementById(previewId);

    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        preview.src = url;
        preview.style.display = 'block';
        preview.onerror = () => {
            preview.style.display = 'none';
            alert('Gagal memuat preview gambar. Pastikan URL gambar valid dan dapat diakses.');
        };
    } else {
        preview.style.display = 'none';
    }
}

window.previewImage = previewImage;

async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            ...options.headers,
        },
        ...options,
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        return { success: false, error: error.message };
    }
}

function showResult(elementId, data, successMessage = 'Berhasil!', errorMessage = 'Gagal!') {
    const element = document.getElementById(elementId);
    if (data.success) {
        element.className = 'result success';
        element.innerHTML = `<strong>${successMessage}</strong><br><pre>${JSON.stringify(data, null, 2)}</pre>`;
    } else {
        element.className = 'result error';
        element.innerHTML = `<strong>${errorMessage}</strong><br>${data.error || 'Unknown error'}`;
    }
}

window.showResult = showResult;

async function connectWhatsApp() {
    const result = await apiCall('/whatsapp/connect', { method: 'POST' });
    if (result.success) {
        alert('Menghubungkan ke WhatsApp... QR code akan muncul di bawah.');
        setTimeout(checkStatus, 3000);
    } else {
        alert('Gagal connect: ' + result.error);
    }
}

window.connectWhatsApp = connectWhatsApp;

async function checkStatus() {
    const result = await apiCall('/health');
    if (result.status === 'ok') {
        document.getElementById('wa-status').textContent = result.whatsapp ? 'Connected' : 'Disconnected';
        document.getElementById('wa-status').className = `status-badge ${result.whatsapp ? 'connected' : 'disconnected'}`;
        document.getElementById('fb-status').textContent = result.facebook ? 'Configured' : 'Not Configured';
        document.getElementById('fb-status').className = `status-badge ${result.facebook ? 'configured' : 'disconnected'}`;
        document.getElementById('shopee-status').textContent = result.shopee ? 'Configured' : 'Not Configured';
        document.getElementById('shopee-status').className = `status-badge ${result.shopee ? 'configured' : 'disconnected'}`;

        const qrSection = document.getElementById('qr-section');
        const qrImage = document.getElementById('qr-image');
        if (!result.whatsapp) {
            const qrResult = await apiCall('/whatsapp/qr');
            if (qrResult.qr) {
                qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrResult.qr)}`;
                qrSection.style.display = 'block';
            } else {
                qrSection.style.display = 'none';
            }
        } else {
            qrSection.style.display = 'none';
        }
    }
}

window.checkStatus = checkStatus;

async function sendMessage(event) {
    event.preventDefault();
    const phone = document.getElementById('phone').value;
    const message = document.getElementById('message').value;

    const result = await apiCall('/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ phone, message }),
    });

    showResult('send-result', result, 'Pesan terkirim!', 'Gagal kirim:');
    loadActivity();
}

async function sendMedia(event) {
    event.preventDefault();
    const phone = document.getElementById('media-phone').value;
    const mediaUrl = document.getElementById('media-url').value;
    const caption = document.getElementById('media-caption').value;
    const link = document.getElementById('media-link').value;

    if (!mediaUrl) {
        alert('URL Gambar wajib diisi');
        return;
    }

    const result = await apiCall('/whatsapp/send-media', {
        method: 'POST',
        body: JSON.stringify({ phone, mediaUrl, mediaType: 'image', caption, link }),
    });

    if (result.success) {
        showResult('media-result', result, 'Gambar terkirim!', 'Gagal kirim:');
    } else {
        showResult('media-result', result, 'Gagal', 'Gagal kirim:');
        if (result.error && result.error.includes('timeout')) {
            alert('Timeout: URL gambar mungkin tidak dapat diakses. Coba URL lain atau download gambar terlebih dahulu.');
        }
    }
    loadActivity();
}

async function sendBulkMedia(event) {
    event.preventDefault();
    const phonesText = document.getElementById('bulk-media-phones').value;
    const mediaUrl = document.getElementById('bulk-media-url').value;
    const caption = document.getElementById('bulk-media-caption').value;
    const link = document.getElementById('bulk-media-link').value;
    const phones = phonesText.split(',').map(p => p.trim()).filter(p => p);

    if (!mediaUrl) {
        alert('URL Gambar wajib diisi');
        return;
    }

    if (phones.length > 100) {
        alert('Maksimal 100 nomor per request');
        return;
    }

    const results = { success: 0, failed: 0, errors: [] };

    for (const phone of phones) {
        try {
            const result = await apiCall('/whatsapp/send-media', {
                method: 'POST',
                body: JSON.stringify({ phone, mediaUrl, mediaType: 'image', caption, link }),
            });

            if (result.success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push({ phone, error: result.error || 'Unknown error' });
            }

            await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 10000));
        } catch (error) {
            results.failed++;
            results.errors.push({ phone, error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }

    const resultDiv = document.getElementById('bulk-media-result');
    resultDiv.className = 'result ' + (results.failed === 0 ? 'success' : 'error');
    resultDiv.innerHTML = `<strong>Bulk gambar selesai!</strong><br>✅ ${results.success} terkirim, ❌ ${results.failed} gagal<br><pre>${JSON.stringify(results.errors.slice(0, 5), null, 2)}</pre>`;
    resultDiv.style.display = 'block';
    loadActivity();
}

window.sendMedia = sendMedia;
window.sendBulkMedia = sendBulkMedia;

async function sendBulkMessages(event) {
    event.preventDefault();
    const phonesText = document.getElementById('bulk-phones').value;
    const message = document.getElementById('bulk-message').value;
    const phones = phonesText.split(',').map(p => p.trim()).filter(p => p);

    if (phones.length > 100) {
        alert('Maksimal 100 nomor per request');
        return;
    }

    const result = await apiCall('/whatsapp/send-bulk', {
        method: 'POST',
        body: JSON.stringify({ phones, message }),
    });

    showResult('bulk-result', result, `Bulk selesai! ${result.results?.success || 0} terkirim`, 'Gagal:');
    loadActivity();
}

window.sendBulkMessages = sendBulkMessages;

async function addContact(event) {
    event.preventDefault();
    const phone = document.getElementById('contact-phone').value;
    const name = document.getElementById('contact-name').value;
    const tagsText = document.getElementById('contact-tags').value;
    const tags = tagsText.split(',').map(t => t.trim()).filter(t => t);

    const result = await apiCall('/contacts', {
        method: 'POST',
        body: JSON.stringify({ phone, name, tags }),
    });

    showResult('add-contact-result', result, 'Kontak ditambahkan!', 'Gagal:');
    if (result.success) {
        document.getElementById('contact-phone').value = '';
        document.getElementById('contact-name').value = '';
        document.getElementById('contact-tags').value = '';
        loadContacts();
        loadActivity();
    }
}

let contactsPage = 1;
const contactsPerPage = 20;
let allContacts = [];
let contactTags = new Set();

async function loadContacts() {
    const search = document.getElementById('contact-search')?.value || '';
    const tagFilter = document.getElementById('contact-tag-filter')?.value || '';
    const statusFilter = document.getElementById('contact-status-filter')?.value || '';

    const result = await apiCall('/contacts');
    let contacts = result.success && result.data ? result.data : [];

    allContacts = contacts;

    contactTags = new Set(contacts.flatMap(c => Array.isArray(c.tags) ? c.tags : []));
    populateTagFilter();

    if (search) {
        const q = search.toLowerCase();
        contacts = contacts.filter(c => (c.name || '').toLowerCase().includes(q) || c.phone.includes(q));
    }

    if (tagFilter) {
        contacts = contacts.filter(c => Array.isArray(c.tags) && c.tags.includes(tagFilter));
    }

    if (statusFilter === 'opted-in') {
        contacts = contacts.filter(c => c.optedIn);
    } else if (statusFilter === 'opted-out') {
        contacts = contacts.filter(c => c.optedOut);
    }

    const total = contacts.length;
    const totalPages = Math.max(1, Math.ceil(total / contactsPerPage));
    if (contactsPage > totalPages) contactsPage = totalPages;
    const start = (contactsPage - 1) * contactsPerPage;
    const pageContacts = contacts.slice(start, start + contactsPerPage);

    const tbody = document.getElementById('contacts-table-body');
    if (!tbody) return;

    if (pageContacts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Belum ada kontak</td></tr>';
    } else {
        tbody.innerHTML = pageContacts.map(contact => `
            <tr>
                <td>${contact.id}</td>
                <td>${contact.phone}</td>
                <td>${contact.name || '-'}</td>
                <td>${(Array.isArray(contact.tags) ? contact.tags : []).map(tag => `<span class="badge badge-info">${tag}</span>`).join(' ') || '-'}</td>
                <td>${contact.optedIn ? '<span class="badge badge-success">Opted In</span>' : '<span class="badge badge-danger">Opted Out</span>'}</td>
                <td>${contact.messageCount || 0}</td>
                <td>${contact.createdAt ? new Date(contact.createdAt).toLocaleString('id-ID') : '-'}</td>
                <td>
                    <button onclick="deleteContact(${contact.id})" class="btn btn-danger" style="padding: 4px 8px; font-size: 0.85em;">Hapus</button>
                </td>
            </tr>
        `).join('');
    }

    renderContactsPagination(totalPages);
    const totalEl = document.getElementById('total-contacts');
    if (totalEl) totalEl.textContent = total;
}

function populateTagFilter() {
    const select = document.getElementById('contact-tag-filter');
    if (!select) return;

    const current = select.value;
    const options = Array.from(contactTags).sort().map(tag => `<option value="${tag}">${tag}</option>`).join('');
    select.innerHTML = '<option value="">Semua Tags</option>' + options;
    select.value = current;
}

function renderContactsPagination(totalPages) {
    const container = document.getElementById('contacts-pagination');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `<button onclick="goToContactsPage(${contactsPage - 1})" ${contactsPage === 1 ? 'disabled' : ''}>Prev</button>`;
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="${i === contactsPage ? 'active' : ''}" onclick="goToContactsPage(${i})">${i}</button>`;
    }
    html += `<button onclick="goToContactsPage(${contactsPage + 1})" ${contactsPage === totalPages ? 'disabled' : ''}>Next</button>`;
    container.innerHTML = html;
}

function goToContactsPage(page) {
    contactsPage = page;
    loadContacts();
}

window.goToContactsPage = goToContactsPage;

async function deleteContact(id) {
    if (!confirm('Hapus kontak ini?')) return;

    const result = await apiCall(`/contacts/${id}`, { method: 'DELETE' });
    if (result.success) {
        loadContacts();
        loadActivity();
    } else {
        alert('Gagal hapus: ' + result.error);
    }
}

window.deleteContact = deleteContact;

async function exportContacts() {
    const result = await apiCall('/contacts/export?format=json');
    if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts.json';
        a.click();
        URL.revokeObjectURL(url);
    } else {
        alert('Gagal export: ' + result.error);
    }
}

window.exportContacts = exportContacts;

async function exportContactsCSV() {
    const result = await apiCall('/contacts/export?format=csv');
    if (result.success) {
        const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts.csv';
        a.click();
        URL.revokeObjectURL(url);
    } else {
        alert('Gagal export CSV: ' + result.error);
    }
}

window.exportContactsCSV = exportContactsCSV;

async function importContacts(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        let contacts = [];

        if (file.name.endsWith('.json')) {
            const json = JSON.parse(text);
            contacts = Array.isArray(json) ? json : json.data || [];
        } else if (file.name.endsWith('.csv')) {
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                alert('File CSV kosong');
                return;
            }
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].match(/("([^"]|"")*"|[^,]*)/g)?.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"')) || [];
                const contact = {};
                headers.forEach((h, idx) => {
                    contact[h] = values[idx] || '';
                });
                contacts.push(contact);
            }
        }

        if (!contacts.length) {
            alert('Tidak ada kontak ditemukan di file');
            return;
        }

        if (!confirm(`Import ${contacts.length} kontak?`)) return;

        const result = await apiCall('/contacts/import', {
            method: 'POST',
            body: JSON.stringify({ contacts, format: file.name.endsWith('.csv') ? 'csv' : 'json' }),
        });

        if (result.success) {
            alert(result.message || `Import ${result.results.success} kontak berhasil`);
            loadContacts();
            loadActivity();
        } else {
            alert('Gagal import: ' + result.error);
        }
    } catch (error) {
        alert('Gagal membaca file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }

    event.target.value = '';
}

window.importContacts = importContacts;

function onCampaignTypeChange() {
    const type = document.getElementById('campaign-type').value;
    const mediaFields = document.getElementById('media-fields');
    const messageField = document.getElementById('campaign-message');
    if (mediaFields && messageField) {
        mediaFields.style.display = type === 'media' ? 'block' : 'none';
        messageField.required = type === 'text';
    }
}

window.onCampaignTypeChange = onCampaignTypeChange;

function onTargetModeChange() {
    const mode = document.getElementById('campaign-target-mode').value;
    const tagGroup = document.getElementById('target-tag-group');
    const manualGroup = document.getElementById('manual-phones-group');
    if (tagGroup) tagGroup.style.display = mode === 'tag' ? 'block' : 'none';
    if (manualGroup) manualGroup.style.display = mode === 'manual' ? 'block' : 'none';
}

window.onTargetModeChange = onTargetModeChange;

async function loadCampaignTags() {
    const contacts = await apiCall('/contacts');
    const tags = new Set();
    if (contacts.success && contacts.data) {
        contacts.data.forEach(c => {
            (c.tags || []).forEach((t) => tags.add(t));
        });
    }
    const select = document.getElementById('campaign-target-tag');
    if (!select) return;
    select.innerHTML = '<option value="">Pilih tag...</option>' + Array.from(tags).sort().map(t => `<option value="${t}">${t}</option>`).join('');
}

async function createCampaign(event) {
    event.preventDefault();
    const name = document.getElementById('campaign-name').value;
    const type = document.getElementById('campaign-type').value;
    const message = document.getElementById('campaign-message').value;
    const targetMode = document.getElementById('campaign-target-mode').value;
    const targetTag = document.getElementById('campaign-target-tag').value;
    const manualPhonesText = document.getElementById('campaign-manual-phones').value;
    const scheduleAt = document.getElementById('campaign-schedule').value;
    const mediaUrl = document.getElementById('campaign-media-url').value;
    const mediaType = document.getElementById('campaign-media-url') ? 'image' : 'image';
    const caption = document.getElementById('campaign-caption').value;
    const link = document.getElementById('campaign-link').value;

    if (type === 'text' && !message) {
        alert('Pesan wajib diisi untuk kampanye teks');
        return;
    }

    if (type === 'media' && !mediaUrl) {
        alert('URL gambar wajib diisi untuk kampanye media');
        return;
    }

    const manualPhones = targetMode === 'manual' ? manualPhonesText.split(',').map(p => p.trim()).filter(p => p) : [];

    const result = await apiCall('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
            name,
            type,
            message,
            targetMode,
            targetTag: targetMode === 'tag' ? targetTag : undefined,
            manualPhones: targetMode === 'manual' ? manualPhones : undefined,
            mediaUrl: type === 'media' ? mediaUrl : undefined,
            mediaType: type === 'media' ? mediaType : undefined,
            caption: type === 'media' ? caption : undefined,
            link: type === 'media' ? link : undefined,
            scheduleAt: scheduleAt || undefined,
        }),
    });

    showResult('create-campaign-result', result, 'Kampanye dibuat!', 'Gagal:');
    if (result.success) {
        loadCampaigns();
        loadActivity();
    }
}

async function loadCampaigns() {
    const result = await apiCall('/campaigns');
    const container = document.getElementById('campaigns-list');

    if (result.success && result.data && result.data.length > 0) {
        container.innerHTML = result.data.map(campaign => `
            <div class="campaign-item">
                <h4>${campaign.name}</h4>
                <p>Tipe: <strong>${campaign.type === 'media' ? 'Gambar + Caption + Link' : 'Pesan Teks'}</strong></p>
                <p>Target: <strong>${campaign.targetMode === 'all' ? 'Semua Kontak' : campaign.targetMode === 'tag' ? `Tag: ${campaign.targetTag}` : 'Manual'}</strong></p>
                <p>Status: <strong>${campaign.status}</strong></p>
                <p>Terkirim: ${campaign.sentCount} / ${campaign.totalContacts}</p>
                <p>Dibuat: ${new Date(campaign.createdAt).toLocaleString('id-ID')}</p>
                ${campaign.status === 'draft' ? `<button onclick="startCampaign(${campaign.id})" class="btn btn-success">Mulai</button>` : ''}
                ${campaign.status === 'running' ? `<button onclick="stopCampaign(${campaign.id})" class="btn btn-danger">Stop</button>` : ''}
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="empty-state">Belum ada kampanye</p>';
    }
}

async function startCampaign(campaignId) {
    const result = await apiCall(`/campaigns/${campaignId}/start`, { method: 'POST' });
    if (result.success) {
        alert('Kampanye dimulai!');
        loadCampaigns();
    } else {
        alert('Gagal: ' + result.error);
    }
}

async function stopCampaign(campaignId) {
    const result = await apiCall(`/campaigns/${campaignId}/stop`, { method: 'POST' });
    if (result.success) {
        alert('Kampanye dihentikan');
        loadCampaigns();
    } else {
        alert('Gagal: ' + result.error);
    }
}

window.createCampaign = createCampaign;
window.loadCampaigns = loadCampaigns;
window.startCampaign = startCampaign;
window.stopCampaign = stopCampaign;

async function searchShopeeProducts(event) {
    event.preventDefault();
    const keyword = document.getElementById('shopee-keyword').value;
    const container = document.getElementById('shopee-results');

    container.innerHTML = '<p>Mencari produk...</p>';

    const result = await apiCall(`/shopee/products?keyword=${encodeURIComponent(keyword)}&limit=20`);

    if (result.success && result.data && result.data.length > 0) {
        container.innerHTML = result.data.map(product => `
            <div class="product-card">
                <img src="${product.imageUrl || 'https://via.placeholder.com/250'}" alt="${product.title}">
                <div class="product-info">
                    <h4>${product.title}</h4>
                    <div>
                        <span class="price">Rp ${product.price.toLocaleString('id-ID')}</span>
                        ${product.originalPrice ? `<span class="original-price">Rp ${product.originalPrice.toLocaleString('id-ID')}</span>` : ''}
                    </div>
                    <div class="commission">Komisi: ${product.commissionRate}%</div>
                    <div class="shop-name">🏪 ${product.shopName}</div>
                    ${product.affiliateUrl ? `<a href="${product.affiliateUrl}" target="_blank" class="btn btn-primary" style="margin-top: 10px; display: inline-block; text-decoration: none;">Buka Link</a>` : ''}
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="empty-state">Tidak ada produk ditemukan</p>';
    }
}

async function loadSafetyMetrics() {
    const result = await apiCall('/safety/metrics');
    const container = document.getElementById('safety-metrics');

    if (result.success && result.data) {
        const data = result.data;
        container.innerHTML = `
            <div class="metric-card">
                <h3>Rate Limits</h3>
                <p>Max pesan/hari: <strong>${data.maxMessagesPerDay}</strong></p>
                <p>Max pesan/jam: <strong>${data.maxMessagesPerHour}</strong></p>
                <p>Min delay: <strong>${data.minDelayBetweenMessagesMs / 1000} detik</strong></p>
            </div>
            <div class="metric-card">
                <h3>Warmup Mode</h3>
                <p>Hari: <strong>${data.warmupStartDay} - ${data.warmupEndDay}</strong></p>
                <p>Limit awal: <strong>${data.warmupStartLimit} pesan/hari</strong></p>
                <p>Limit akhir: <strong>${data.warmupEndLimit} pesan/hari</strong></p>
            </div>
            <div class="metric-card">
                <h3>Compliance</h3>
                <p>Total kontak: <strong>${data.compliance.totalContacts}</strong></p>
                <p>Opted in: <strong>${data.compliance.optedIn}</strong></p>
                <p>Opted out: <strong>${data.compliance.optedOut}</strong></p>
                <p>Opt-out rate: <strong>${data.compliance.optOutRate.toFixed(2)}%</strong></p>
            </div>
        `;
    }
}

async function loadActivity() {
    const result = await apiCall('/activity');
    const container = document.getElementById('activity-list');

    if (result.success && result.data && result.data.length > 0) {
        container.innerHTML = result.data.map((item) => {
            const time = new Date(item.time).toLocaleString('id-ID');
            let typeClass = 'log-item';
            if (item.type === 'contact') typeClass += ' activity-contact';
            if (item.type === 'campaign') typeClass += ' activity-campaign';
            if (item.type === 'error') typeClass += ' activity-error';

            return `
                <div class="${typeClass}">
                    <div class="time">${time}</div>
                    <div class="message">
                        <strong>${item.title}</strong><br>
                        ${item.description}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        container.innerHTML = '<p class="empty-state">Belum ada aktivitas</p>';
    }
}

window.loadActivity = loadActivity;

window.sendMessage = sendMessage;
window.sendBulkMessages = sendBulkMessages;
window.addContact = addContact;
window.loadContacts = loadContacts;
window.createCampaign = createCampaign;
window.loadCampaigns = loadCampaigns;
window.startCampaign = startCampaign;
window.searchShopeeProducts = searchShopeeProducts;
window.loadSafetyMetrics = loadSafetyMetrics;

document.addEventListener('DOMContentLoaded', () => {
    checkStatus();
    loadContacts();
    loadCampaigns();
    loadCampaignTags();
    loadSafetyMetrics();
    loadActivity();

    onCampaignTypeChange();
    onTargetModeChange();

    setInterval(checkStatus, 30000);
    setInterval(loadActivity, 15000);
});
