/**
 * CareMom - Main Application Controller with Full Editability across all modules
 */

class CareMomApp {
  constructor() {
    this.patient = INITIAL_PATIENT_PROFILE;
    this.documents = [];
    this.logs = [];
    this.medications = [];
    this.contacts = [];
    this.reminders = [];
    this.caregivers = [];
    this.rehabRules = [];
    
    this.activeTab = 'docs';
    this.docCategoryFilter = 'all';
    this.docSearchQuery = '';
    
    // Form edit tracking IDs
    this.editingDocId = null;
    this.editingLogId = null;
    this.editingMedId = null;
    this.editingContactId = null;
    
    // File upload temp storage
    this.pendingUploadFile = null;
  }

  async init() {
    try {
      await window.db.init();
      await this.loadState();
      this.bindEvents();
      this.renderAll();
      this.initFirebaseSync();
    } catch (err) {
      console.error("Initialization error:", err);
    }
  }

  async loadState() {
    // Load patient settings if customized
    const savedSettings = await window.db.getAll('settings');
    const profileSetting = savedSettings ? savedSettings.find(s => s.key === 'patientProfile') : null;
    if (profileSetting && profileSetting.value) {
      this.patient = profileSetting.value;
    }

    const remindersSetting = savedSettings ? savedSettings.find(s => s.key === 'reminders') : null;
    this.reminders = (remindersSetting && remindersSetting.value) ? remindersSetting.value : [];

    const caregiversSetting = savedSettings ? savedSettings.find(s => s.key === 'caregivers') : null;
    this.caregivers = (caregiversSetting && caregiversSetting.value) ? caregiversSetting.value : [];

    const rulesSetting = savedSettings ? savedSettings.find(s => s.key === 'rehabRules') : null;
    this.rehabRules = (rulesSetting && rulesSetting.value) ? rulesSetting.value : [];

    // Load from IndexedDB
    let docs = await window.db.getAll('documents');
    let logs = await window.db.getAll('logs');
    let meds = await window.db.getAll('medications');
    let cnts = await window.db.getAll('contacts');

    this.documents = docs || [];
    this.logs = (logs || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    this.medications = meds || [];
    this.contacts = cnts || [];
  }

  bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetView = e.currentTarget.dataset.tab;
        this.switchTab(targetView);
      });
    });

    // Document Search & Filter
    const searchInput = document.getElementById('docSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.docSearchQuery = e.target.value.toLowerCase();
        this.renderDocuments();
      });
    }

    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.docCategoryFilter = e.currentTarget.dataset.cat;
        this.renderDocuments();
      });
    });

    // Modal Close Triggers (Only close via explicit X or Cancel buttons to prevent accidental form closing)
    document.querySelectorAll('.close-btn, .btn-modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
      });
    });

    // File Drag & Drop Upload Handlers
    const dropzone = document.getElementById('fileDropzone');
    const fileInput = document.getElementById('docFileInput');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          this.handleFileSelected(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFileSelected(e.target.files[0]);
        }
      });
    }

    // Document Form Submit
    const addDocForm = document.getElementById('addDocForm');
    if (addDocForm) {
      addDocForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveDocument();
      });
    }

    // Care Log Form Submit
    const addLogForm = document.getElementById('addLogForm');
    if (addLogForm) {
      addLogForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveLog();
      });
    }

    // Patient Profile Edit Submit
    document.getElementById('btnEditPatientProfile')?.addEventListener('click', () => this.openEditPatientModal());
    document.getElementById('editPatientForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePatientProfile();
    });

    // Medication Form Submit
    document.getElementById('btnAddMedication')?.addEventListener('click', () => this.openAddMedicationModal());
    document.getElementById('addMedForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveMedication();
    });

    // Contact Form Submit
    document.getElementById('btnAddContact')?.addEventListener('click', () => this.openAddContactModal());
    document.getElementById('addContactForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveContact();
    });

    // Reminders & Caregivers & Rules Form Submits
    document.getElementById('btnAddReminder')?.addEventListener('click', () => this.openAddReminderModal());
    document.getElementById('addReminderForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveReminder();
    });

    document.getElementById('btnAddCaregiver')?.addEventListener('click', () => this.openAddCaregiverModal());
    document.getElementById('addCaregiverForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCaregiver();
    });

    document.getElementById('btnAddRehabRule')?.addEventListener('click', () => this.openAddRehabRuleModal());
    document.getElementById('addRehabRuleForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRehabRule();
    });

    // Quick Action Buttons
    document.getElementById('btnOpenAddDoc')?.addEventListener('click', () => this.openAddDocumentModal());
    document.getElementById('btnOpenAddLog')?.addEventListener('click', () => this.openAddLogModal());
    document.getElementById('btnOpenShare')?.addEventListener('click', () => this.openModal('modalShare'));
    document.getElementById('btnPrintReport')?.addEventListener('click', () => this.printMedicalReport());

    // Export & Import Database Buttons
    document.getElementById('btnExportBackup')?.addEventListener('click', () => this.exportBackupJSON());
    document.getElementById('btnImportBackup')?.addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput')?.addEventListener('change', (e) => this.importBackupJSON(e));

    // Clear Seed Data Button
    document.getElementById('btnClearSampleData')?.addEventListener('click', () => this.clearSampleData());

    // Email Send Generator Submit
    document.getElementById('sendEmailForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.triggerEmailSend();
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('active', view.id === `tab-${tabId}`);
    });

    if (tabId === 'share') {
      this.updateShareSummaryText();
    }
  }

  renderAll() {
    this.renderPatientHeader();
    this.renderDocuments();
    this.renderCareLogs();
    this.renderRemindersAndCaregivers();
    this.renderMedications();
    this.renderContacts();
    this.updateShareSummaryText();
  }

  renderPatientHeader() {
    const el = document.getElementById('patientHeroDetails');
    if (!el) return;

    // Calculate days since surgery
    const surgDate = new Date(this.patient.surgeryDate);
    const today = new Date();
    const diffTime = Math.abs(today - surgDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    el.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2>${this.escapeHtml(this.patient.name)} (${this.patient.age} let)</h2>
          <p style="color: var(--primary-100); font-size: 0.9rem; margin-bottom: 0.4rem;">
            <strong>Diagnóza:</strong> ${this.escapeHtml(this.patient.diagnosis)}
          </p>
        </div>
        <button class="btn btn-secondary btn-sm" id="btnEditPatientProfile" onclick="app.openEditPatientModal()" style="background: rgba(255,255,255,0.25); color: white; border: 1px solid rgba(255,255,255,0.4); font-weight: 600; cursor: pointer;">
          <i data-lucide="edit-3"></i> Upravit profil
        </button>
      </div>
      <div class="patient-tags">
        <span class="patient-badge"><i data-lucide="calendar"></i> Operováno: ${diffDays}. pooperační den</span>
        <span class="patient-badge"><i data-lucide="hospital"></i> ${this.escapeHtml(this.patient.hospital)}</span>
        <span class="patient-badge alert"><i data-lucide="shield-alert"></i> ${this.escapeHtml(this.patient.allergies)}</span>
        <span class="patient-badge"><i data-lucide="user"></i> Ošetřující: ${this.escapeHtml(this.patient.attendingDoctor)}</span>
      </div>
    `;

    // Render Stats
    document.getElementById('statDaysCount').innerText = `${diffDays}. den`;
    document.getElementById('statDocsCount').innerText = `${this.documents.length}`;
    document.getElementById('statLogsCount').innerText = `${this.logs.length}`;

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Patient Profile Edit Logic ---

  openEditPatientModal() {
    document.getElementById('patientNameInput').value = this.patient.name || '';
    document.getElementById('patientAgeInput').value = this.patient.age || '';
    document.getElementById('patientBirthDateInput').value = this.patient.birthDate || '';
    document.getElementById('patientDiagnosisInput').value = this.patient.diagnosis || '';
    document.getElementById('patientSurgeryDateInput').value = this.patient.surgeryDate || '';
    document.getElementById('patientHospitalInput').value = this.patient.hospital || '';
    document.getElementById('patientDoctorInput').value = this.patient.attendingDoctor || '';
    document.getElementById('patientAllergiesInput').value = this.patient.allergies || '';
    document.getElementById('patientInsuranceInput').value = this.patient.insuranceCompany || '';

    this.openModal('modalEditPatient');
  }

  async savePatientProfile() {
    this.patient = {
      ...this.patient,
      name: document.getElementById('patientNameInput').value.trim() || 'Maminka',
      age: parseInt(document.getElementById('patientAgeInput').value, 10) || 74,
      birthDate: document.getElementById('patientBirthDateInput').value.trim() || '',
      diagnosis: document.getElementById('patientDiagnosisInput').value.trim() || 'TEP Kyčle',
      surgeryDate: document.getElementById('patientSurgeryDateInput').value || new Date().toISOString().split('T')[0],
      hospital: document.getElementById('patientHospitalInput').value.trim() || 'Nemocnice',
      attendingDoctor: document.getElementById('patientDoctorInput').value.trim() || 'MUDr. Ortoped',
      allergies: document.getElementById('patientAllergiesInput').value.trim() || 'Žádné známé alergie',
      insuranceCompany: document.getElementById('patientInsuranceInput').value.trim() || 'VZP'
    };

    await window.db.save('settings', { key: 'patientProfile', value: this.patient });
    await this.syncToFirebase('app_state', 'patientProfile', this.patient);
    this.closeAllModals();
    this.renderPatientHeader();
    this.updateShareSummaryText();
  }

  // --- Documents Logic & CRUD ---

  renderDocuments() {
    const container = document.getElementById('documentsGrid');
    if (!container) return;

    let filtered = this.documents.filter(doc => {
      const matchCat = (this.docCategoryFilter === 'all') || (doc.category === this.docCategoryFilter);
      const matchSearch = !this.docSearchQuery || 
        doc.title.toLowerCase().includes(this.docSearchQuery) ||
        doc.summary.toLowerCase().includes(this.docSearchQuery) ||
        doc.doctor.toLowerCase().includes(this.docSearchQuery) ||
        doc.tags.some(t => t.toLowerCase().includes(this.docSearchQuery));

      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--slate-600);">
          <i data-lucide="folder-open" style="width: 48px; height: 48px; stroke-width: 1.5; color: var(--slate-300); margin-bottom: 0.75rem;"></i>
          <p style="font-weight: 600; font-size: 1.1rem;">Žádné lékařské dokumenty neodpovídají zadanému filtru</p>
          <p style="font-size: 0.875rem; color: var(--slate-600);">Zkuste změnit vyhledávací dotaz nebo nahrajte nový dokument.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(doc => {
      const isPdf = doc.fileType === 'pdf';
      const icon = isPdf ? 'file-text' : (doc.fileType === 'image' ? 'image' : 'file');
      
      return `
        <div class="doc-card" id="doc_card_${doc.id}">
          <div>
            <div class="doc-card-header">
              <div class="doc-type-icon">
                <i data-lucide="${icon}"></i>
              </div>
              <div>
                <div class="doc-card-title">${this.escapeHtml(doc.title)}</div>
                <div class="doc-meta">
                  <span><i data-lucide="calendar" style="width:12px; height:12px;"></i> ${doc.date}</span> &bull; 
                  <span>${this.escapeHtml(doc.facility || doc.doctor)}</span>
                </div>
              </div>
            </div>

            <div class="doc-summary">
              ${this.escapeHtml(doc.summary)}
            </div>

            <div class="doc-tags">
              <span class="doc-tag" style="background: var(--primary-50); color: var(--primary-700); font-weight: 600;">
                ${this.escapeHtml(doc.categoryLabel || doc.category)}
              </span>
              ${(doc.tags || []).map(t => `<span class="doc-tag">${this.escapeHtml(t)}</span>`).join('')}
            </div>
          </div>

          <div class="doc-footer-actions">
            <button class="btn btn-secondary btn-sm" onclick="app.viewDocument('${doc.id}')">
              <i data-lucide="eye"></i> Zobrazit
            </button>
            <button class="btn btn-secondary btn-sm" onclick="app.openEditDocumentModal('${doc.id}')">
              <i data-lucide="edit-3"></i> Upravit
            </button>
            <button class="btn btn-outline btn-sm" onclick="app.shareSingleDocument('${doc.id}')">
              <i data-lucide="share-2"></i> Sdílet
            </button>
            <button class="btn btn-secondary btn-sm" style="margin-left:auto; color: var(--danger-600);" onclick="app.deleteDocument('${doc.id}')" title="Smazat">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  handleFileSelected(file) {
    this.pendingUploadFile = file;
    const dropzone = document.getElementById('fileDropzone');
    dropzone.innerHTML = `
      <i data-lucide="check-circle-2" style="width: 36px; height: 36px; color: var(--success-500);"></i>
      <p style="font-weight: 600; color: var(--slate-900);">${this.escapeHtml(file.name)}</p>
      <p style="font-size: 0.8rem; color: var(--slate-600);">${(file.size / 1024).toFixed(1)} KB &bull; Klikněte pro změnu</p>
    `;
    
    // Auto-fill title if empty
    const titleInput = document.getElementById('docTitleInput');
    if (titleInput && !titleInput.value) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, "");
    }

    if (window.lucide) window.lucide.createIcons();
  }

  openAddDocumentModal() {
    this.editingDocId = null;
    document.getElementById('modalAddDocTitle').innerText = 'Uložit novou lékařskou zprávu';
    document.getElementById('addDocForm').reset();
    this.pendingUploadFile = null;
    document.getElementById('fileDropzone').innerHTML = `
      <i data-lucide="upload-cloud" style="width: 40px; height: 40px; color: var(--primary-600);"></i>
      <p style="font-weight: 600; color: var(--slate-800);">Přetáhněte sem soubor nebo klikněte pro výběr</p>
      <p style="font-size: 0.8rem; color: var(--slate-600);">Podporované formáty: PDF, JPG, PNG, DOCX</p>
    `;
    if (window.lucide) window.lucide.createIcons();
    this.openModal('modalAddDoc');
  }

  openEditDocumentModal(docId) {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    this.editingDocId = docId;
    document.getElementById('modalAddDocTitle').innerText = 'Upravit lékařskou zprávu';

    document.getElementById('docTitleInput').value = doc.title || '';
    document.getElementById('docCatSelect').value = doc.category || 'propousteci';
    document.getElementById('docDateInput').value = doc.date || '';
    document.getElementById('docDoctorInput').value = doc.doctor || '';
    document.getElementById('docFacilityInput').value = doc.facility || '';
    document.getElementById('docSummaryInput').value = doc.summary || '';
    document.getElementById('docTagsInput').value = (doc.tags || []).join(', ');

    this.pendingUploadFile = null;
    document.getElementById('fileDropzone').innerHTML = `
      <i data-lucide="file-check" style="width: 36px; height: 36px; color: var(--primary-600);"></i>
      <p style="font-weight: 600; color: var(--slate-900);">${this.escapeHtml(doc.fileName || doc.title)}</p>
      <p style="font-size: 0.8rem; color: var(--slate-600);">Klikněte nebo přetáhněte nový soubor pokud jej chcete nahradit</p>
    `;
    if (window.lucide) window.lucide.createIcons();

    this.openModal('modalAddDoc');
  }

  async saveDocument() {
    const title = document.getElementById('docTitleInput').value.trim();
    const category = document.getElementById('docCatSelect').value;
    const date = document.getElementById('docDateInput').value || new Date().toISOString().split('T')[0];
    const doctor = document.getElementById('docDoctorInput').value.trim() || 'Lékař';
    const facility = document.getElementById('docFacilityInput').value.trim() || 'Nocoviště';
    const summary = document.getElementById('docSummaryInput').value.trim() || 'Bez popisu.';
    const tagsRaw = document.getElementById('docTagsInput').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()) : [];

    const catObj = this.getCategoryLabelObj(category);

    if (this.editingDocId) {
      // Update existing document
      const doc = this.documents.find(d => d.id === this.editingDocId);
      if (doc) {
        doc.title = title;
        doc.category = category;
        doc.categoryLabel = catObj.label;
        doc.date = date;
        doc.doctor = doctor;
        doc.facility = facility;
        doc.summary = summary;
        doc.tags = tags;

        if (this.pendingUploadFile) {
          doc.fileType = this.pendingUploadFile.type.includes('image') ? 'image' : 'pdf';
          doc.fileName = this.pendingUploadFile.name;
          doc.fileData = await this.readFileAsDataURL(this.pendingUploadFile);
        }

        await window.db.save('documents', doc);
        await this.syncToFirebase('documents', doc.id, doc);
      }
    } else {
      // Create new document
      let fileData = null;
      let fileType = 'pdf';

      if (this.pendingUploadFile) {
        fileType = this.pendingUploadFile.type.includes('image') ? 'image' : 'pdf';
        fileData = await this.readFileAsDataURL(this.pendingUploadFile);
      }

      const newDoc = {
        id: 'doc_' + Date.now(),
        title,
        category,
        categoryLabel: catObj.label,
        date,
        doctor,
        facility,
        summary,
        tags,
        fileType,
        fileName: this.pendingUploadFile ? this.pendingUploadFile.name : `${title}.pdf`,
        fileData,
        isSeed: false
      };

      await window.db.save('documents', newDoc);
      await this.syncToFirebase('documents', newDoc.id, newDoc);
      this.documents.unshift(newDoc);
    }
    
    this.closeAllModals();
    this.renderDocuments();
    this.renderPatientHeader();
    this.editingDocId = null;
    this.pendingUploadFile = null;
  }

  async viewDocument(docId) {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    const modalBody = document.getElementById('modalViewDocBody');
    const modalTitle = document.getElementById('modalViewDocTitle');

    modalTitle.innerText = doc.title;

    let contentHtml = `
      <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--slate-200);">
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.875rem; color: var(--slate-600); margin-bottom: 0.5rem;">
          <span><strong>Datum:</strong> ${doc.date}</span>
          <span><strong>Lékař:</strong> ${this.escapeHtml(doc.doctor)}</span>
          <span><strong>Zařízení:</strong> ${this.escapeHtml(doc.facility)}</span>
        </div>
        <div style="background: var(--slate-50); padding: 0.85rem; border-radius: var(--radius-sm); font-size: 0.925rem;">
          <strong>Stručný souhrn / Epikríza:</strong>
          <p style="margin-top: 0.25rem; color: var(--slate-800);">${this.escapeHtml(doc.summary)}</p>
        </div>
      </div>
    `;

    if (doc.fileData) {
      if (doc.fileType === 'image') {
        contentHtml += `<div style="text-align: center;"><img src="${doc.fileData}" style="max-width: 100%; border-radius: 8px; box-shadow: var(--shadow-md);" /></div>`;
      } else {
        contentHtml += `<iframe src="${doc.fileData}" style="width: 100%; height: 500px; border: none; border-radius: 8px;"></iframe>`;
      }
    } else {
      contentHtml += `
        <div style="background: var(--slate-100); border: 2px dashed var(--slate-300); border-radius: var(--radius-md); padding: 3rem 1.5rem; text-align: center;">
          <i data-lucide="file-check-2" style="width: 64px; height: 64px; color: var(--primary-600); margin-bottom: 1rem;"></i>
          <h4 style="font-size: 1.15rem; color: var(--slate-900); margin-bottom: 0.5rem;">${this.escapeHtml(doc.title)}</h4>
          <p style="font-size: 0.9rem; color: var(--slate-600); max-width: 500px; margin: 0 auto 1.5rem auto;">
            Tento dokument je uložen v oficiální zdravotní složce pacienta.
          </p>
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button class="btn btn-secondary btn-sm" onclick="app.openEditDocumentModal('${doc.id}')">
              <i data-lucide="edit-3"></i> Upravit zprávu
            </button>
            <button class="btn btn-primary btn-sm" onclick="app.shareSingleDocument('${doc.id}')">
              <i data-lucide="share-2"></i> Sdílet (WhatsApp / E-mail)
            </button>
          </div>
        </div>
      `;
    }

    modalBody.innerHTML = contentHtml;
    if (window.lucide) window.lucide.createIcons();
    this.openModal('modalViewDoc');
  }

  async deleteDocument(docId) {
    if (confirm("Opravdu chcete smazat tento lékařský dokument?")) {
      await window.db.delete('documents', docId);
      await this.syncToFirebase('documents', docId, null, true);
      this.documents = this.documents.filter(d => d.id !== docId);
      this.renderDocuments();
      this.renderPatientHeader();
    }
  }

  // --- Care Log / Notes Logic & CRUD ---

  renderCareLogs() {
    const container = document.getElementById('careLogsTimeline');
    if (!container) return;

    if (this.logs.length === 0) {
      container.innerHTML = `<p style="color: var(--slate-600); text-align: center; padding: 2rem;">Zatím nebyly zapsány žádné poznámky.</p>`;
      return;
    }

    container.innerHTML = this.logs.map(log => {
      return `
        <div class="timeline-item">
          <div class="timeline-badge leky">
            <i data-lucide="notebook-pen"></i>
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <div class="timeline-author">
                <i data-lucide="user-check" style="width:16px; height:16px; color: var(--primary-600);"></i>
                <strong>${this.escapeHtml(log.author)}</strong>
              </div>
              <div class="timeline-time" style="display: flex; align-items: center; gap: 0.5rem;">
                <span><i data-lucide="clock" style="width:14px; height:14px;"></i> ${log.timestamp}</span>
                <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="app.openEditLogModal('${log.id}')" title="Upravit poznámku">
                  <i data-lucide="edit-3" style="width:12px; height:12px;"></i>
                </button>
                <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; color: var(--danger-600);" onclick="app.deleteLog('${log.id}')" title="Smazat poznámku">
                  <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                </button>
              </div>
            </div>

            <h4 style="font-size: 1.05rem; margin-bottom: 0.35rem; color: var(--slate-900);">
              ${this.escapeHtml(log.title)}
            </h4>

            <div class="timeline-body" style="font-size: 0.95rem; white-space: pre-wrap;">
              ${this.escapeHtml(log.content)}
            </div>

            <!-- Comments thread -->
            <div class="comments-section">
              <div style="font-size: 0.8rem; font-weight: 600; color: var(--slate-600); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                <i data-lucide="message-square" style="width:14px; height:14px;"></i> Komentáře a reakce (${(log.comments || []).length}):
              </div>

              ${(log.comments || []).map(c => `
                <div class="comment-item">
                  <div>
                    <span class="comment-author">${this.escapeHtml(c.author)}</span>
                    <span class="comment-time">${c.timestamp}</span>
                  </div>
                  <div style="color: var(--slate-700); margin-top: 0.15rem;">${this.escapeHtml(c.text)}</div>
                </div>
              `).join('')}

              <!-- Add Comment Input -->
              <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                <input type="text" class="form-control" style="font-size: 0.825rem; padding: 0.4rem 0.65rem;" 
                  id="comment_input_${log.id}" placeholder="Napsat komentář k této poznámce...">
                <button class="btn btn-primary btn-sm" onclick="app.addCommentToLog('${log.id}')">
                  Odeslat
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  openAddLogModal() {
    this.editingLogId = null;
    document.getElementById('modalAddLogTitle').innerText = 'Nová poznámka';
    document.getElementById('addLogForm').reset();
    this.openModal('modalAddLog');
  }

  openEditLogModal(logId) {
    const log = this.logs.find(l => l.id === logId);
    if (!log) return;

    this.editingLogId = logId;
    document.getElementById('modalAddLogTitle').innerText = 'Upravit poznámku';

    document.getElementById('logAuthorInput').value = log.author || '';
    document.getElementById('logTitleInput').value = log.title || '';
    document.getElementById('logContentInput').value = log.content || '';

    this.openModal('modalAddLog');
  }

  async saveLog() {
    const author = document.getElementById('logAuthorInput').value.trim() || 'Pečující';
    const title = document.getElementById('logTitleInput').value.trim();
    const content = document.getElementById('logContentInput').value.trim();

    if (this.editingLogId) {
      const log = this.logs.find(l => l.id === this.editingLogId);
      if (log) {
        log.author = author;
        log.title = title;
        log.content = content;

        await window.db.save('logs', log);
        await this.syncToFirebase('logs', log.id, log);
      }
    } else {
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      const newLog = {
        id: 'log_' + Date.now(),
        author,
        timestamp: timeStr,
        date: now.toISOString().split('T')[0],
        title,
        content,
        comments: []
      };

      await window.db.save('logs', newLog);
      await this.syncToFirebase('logs', newLog.id, newLog);
      this.logs.unshift(newLog);
    }
    
    this.closeAllModals();
    this.renderCareLogs();
    this.renderPatientHeader();
    this.updateShareSummaryText();
    this.editingLogId = null;
  }

  async deleteLog(logId) {
    if (confirm("Opravdu chcete smazat tuto poznámku?")) {
      await window.db.delete('logs', logId);
      await this.syncToFirebase('logs', logId, null, true);
      this.logs = this.logs.filter(l => l.id !== logId);
      this.renderCareLogs();
      this.renderPatientHeader();
      this.updateShareSummaryText();
    }
  }

  async addCommentToLog(logId) {
    const input = document.getElementById(`comment_input_${logId}`);
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    const log = this.logs.find(l => l.id === logId);
    if (!log) return;

    if (!log.comments) log.comments = [];

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    log.comments.push({
      id: 'c_' + Date.now(),
      author: 'Rodina',
      timestamp: timeStr,
      text
    });

    await window.db.save('logs', log);
    await this.syncToFirebase('logs', log.id, log);
    this.renderCareLogs();
  }

  // --- Reminders & Caregivers Schedule Logic ---

  sortReminders() {
    this.reminders.sort((a, b) => {
      const dateA = this.parseDate(a.date);
      const dateB = this.parseDate(b.date);
      if (dateA && dateB) {
        return dateB - dateA; // Descending: latest/current date first, past dates below
      }
      return 0;
    });
  }

  parseDate(str) {
    if (!str) return 0;
    // Try matching Czech date: DD. MM. YYYY or D. M. YYYY
    const match = str.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      return new Date(year, month, day).getTime();
    }
    // Fallback try standard ISO or JavaScript date parsing
    const iso = Date.parse(str);
    if (!isNaN(iso)) return iso;
    return 0;
  }

  renderRemindersAndCaregivers() {
    this.sortReminders();

    // Render Reminders
    const remContainer = document.getElementById('remindersContainer');
    if (remContainer) {
      if (this.reminders.length === 0) {
        remContainer.innerHTML = `<p style="color: var(--slate-600); font-size: 0.85rem; padding: 0.5rem 0;">Zatím nebyly zadané žádné termíny.</p>`;
      } else {
        remContainer.innerHTML = this.reminders.map(rem => `
          <div class="alert-box ${rem.type || 'info'}" style="margin-bottom: 0.75rem; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 0.75rem; align-items: center;">
              <i data-lucide="calendar" style="width: 20px; height: 20px; flex-shrink: 0;"></i>
              <div>
                <strong>${this.escapeHtml(rem.date)}</strong>
                <div style="font-size: 0.825rem;">${this.escapeHtml(rem.title)}</div>
              </div>
            </div>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.4rem;" onclick="app.editReminder('${rem.id}')" title="Upravit">
                <i data-lucide="edit-3" style="width:12px; height:12px;"></i>
              </button>
              <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.4rem; color: var(--danger-600);" onclick="app.deleteReminder('${rem.id}')" title="Smazat">
                <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render Caregivers
    const cgContainer = document.getElementById('caregiversContainer');
    if (cgContainer) {
      cgContainer.innerHTML = this.caregivers.map(cg => `
        <li style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--slate-200); padding: 0.4rem 0;">
          <div>
            <strong>${this.escapeHtml(cg.days)}:</strong> ${this.escapeHtml(cg.name)}
          </div>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.35rem;" onclick="app.editCaregiver('${cg.id}')" title="Upravit">
              <i data-lucide="edit-3" style="width:12px; height:12px;"></i>
            </button>
            <button class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.35rem; color: var(--danger-600);" onclick="app.deleteCaregiver('${cg.id}')" title="Smazat">
              <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
            </button>
          </div>
        </li>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  openAddReminderModal() {
    this.editingReminderId = null;
    document.getElementById('modalAddReminderTitle').innerText = 'Přidat nový důležitý termín';
    document.getElementById('addReminderForm').reset();
    this.openModal('modalAddReminder');
  }

  editReminder(id) {
    const rem = this.reminders.find(r => r.id === id);
    if (!rem) return;

    this.editingReminderId = id;
    document.getElementById('modalAddReminderTitle').innerText = 'Upravit důležitý termín';
    document.getElementById('remDateInput').value = rem.date || '';
    document.getElementById('remTitleInput').value = rem.title || '';
    this.openModal('modalAddReminder');
  }

  async saveReminder() {
    const date = document.getElementById('remDateInput').value.trim();
    const title = document.getElementById('remTitleInput').value.trim();

    if (this.editingReminderId) {
      const rem = this.reminders.find(r => r.id === this.editingReminderId);
      if (rem) {
        rem.date = date;
        rem.title = title;
      }
    } else {
      const newRem = {
        id: 'rem_' + Date.now(),
        date,
        title,
        type: 'warning'
      };
      this.reminders.push(newRem);
    }

    await window.db.save('settings', { key: 'reminders', value: this.reminders });
    await this.syncToFirebase('app_state', 'reminders', { items: this.reminders });
    this.closeAllModals();
    this.renderRemindersAndCaregivers();
    this.updateShareSummaryText();
    this.editingReminderId = null;
  }

  async deleteReminder(id) {
    if (confirm("Opravdu chcete smazat tento termín?")) {
      this.reminders = this.reminders.filter(r => r.id !== id);
      await window.db.save('settings', { key: 'reminders', value: this.reminders });
      await this.syncToFirebase('app_state', 'reminders', { items: this.reminders });
      this.renderRemindersAndCaregivers();
      this.updateShareSummaryText();
    }
  }

  openAddCaregiverModal() {
    this.editingCaregiverId = null;
    document.getElementById('modalAddCaregiverTitle').innerText = 'Přidat službu pečujícího';
    document.getElementById('addCaregiverForm').reset();
    this.openModal('modalAddCaregiver');
  }

  editCaregiver(id) {
    const cg = this.caregivers.find(c => c.id === id);
    if (!cg) return;

    this.editingCaregiverId = id;
    document.getElementById('modalAddCaregiverTitle').innerText = 'Upravit službu pečujícího';
    document.getElementById('cgDaysInput').value = cg.days || '';
    document.getElementById('cgNameInput').value = cg.name || '';
    this.openModal('modalAddCaregiver');
  }

  async saveCaregiver() {
    const days = document.getElementById('cgDaysInput').value.trim();
    const name = document.getElementById('cgNameInput').value.trim();

    if (this.editingCaregiverId) {
      const cg = this.caregivers.find(c => c.id === this.editingCaregiverId);
      if (cg) {
        cg.days = days;
        cg.name = name;
      }
    } else {
      const newCg = { id: 'cg_' + Date.now(), days, name };
      this.caregivers.push(newCg);
    }

    await window.db.save('settings', { key: 'caregivers', value: this.caregivers });
    await this.syncToFirebase('app_state', 'caregivers', { items: this.caregivers });
    this.closeAllModals();
    this.renderRemindersAndCaregivers();
    this.editingCaregiverId = null;
  }

  async deleteCaregiver(id) {
    if (confirm("Opravdu chcete smazat tuto položku rozpisu?")) {
      this.caregivers = this.caregivers.filter(c => c.id !== id);
      await window.db.save('settings', { key: 'caregivers', value: this.caregivers });
      await this.syncToFirebase('app_state', 'caregivers', { items: this.caregivers });
      this.renderRemindersAndCaregivers();
    }
  }

  // --- Medications Logic & CRUD ---

  renderMedications() {
    const container = document.getElementById('medicationList');
    if (!container) return;

    if (this.medications.length === 0) {
      container.innerHTML = `<p style="color: var(--slate-600); text-align: center; padding: 1.5rem;">Zatím nebyly zadané žádné léky.</p>`;
    } else {
      container.innerHTML = this.medications.map(med => {
        const isChecked = med.checkedToday;
        return `
          <div class="med-item ${isChecked ? 'checked' : ''}" id="med_item_${med.id}">
            <div style="display: flex; align-items: flex-start; gap: 0.85rem;">
              <input type="checkbox" style="width: 20px; height: 20px; accent-color: var(--primary-600); cursor: pointer; margin-top: 0.25rem;" 
                ${isChecked ? 'checked' : ''} onchange="app.toggleMedicationChecked('${med.id}', this.checked)">
              <div class="med-info">
                <h4>${this.escapeHtml(med.name)}</h4>
                <p><strong>Účel:</strong> ${this.escapeHtml(med.purpose)}</p>
                <p style="font-size: 0.825rem; color: var(--slate-600); margin-top: 0.2rem;">
                  <strong>Dávkování:</strong> ${this.escapeHtml(med.dosage)} (${this.escapeHtml(med.instructions)})
                </p>
                <div class="med-badges">
                  ${med.timing.map(t => `<span class="med-badge">${this.getTimingLabel(t)}</span>`).join('')}
                  <span class="med-badge" style="background: var(--primary-50); color: var(--primary-700);">
                    Zásoba: ${med.remainingStock}/${med.totalStock} ks
                  </span>
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 0.35rem; flex-direction: column; align-items: flex-end;">
              <button class="btn btn-secondary btn-sm" onclick="app.editMedStock('${med.id}')" title="Změnit zásobu">
                <i data-lucide="pill"></i> Zásoba
              </button>
              <div style="display: flex; gap: 0.25rem; margin-top: 0.25rem;">
                <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.4rem;" onclick="app.openEditMedicationModal('${med.id}')" title="Upravit lék">
                  <i data-lucide="edit-3" style="width:12px; height:12px;"></i>
                </button>
                <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.4rem; color: var(--danger-600);" onclick="app.deleteMedication('${med.id}')" title="Smazat lék">
                  <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Render Rehab Rules Card
    const rulesContainer = document.getElementById('rehabRulesContainer');
    if (rulesContainer) {
      rulesContainer.innerHTML = this.rehabRules.map(rule => `
        <div class="alert-box ${rule.type}" style="margin-bottom: 0.85rem; justify-content: space-between; align-items: flex-start;">
          <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
            <i data-lucide="${rule.type === 'danger' ? 'alert-triangle' : 'info'}" style="width: 20px; height: 20px; flex-shrink: 0;"></i>
            <div>
              <strong style="display: block; font-size: 0.95rem; margin-bottom: 0.2rem;">${this.escapeHtml(rule.title)}</strong>
              <div>${this.escapeHtml(rule.desc)}</div>
            </div>
          </div>
          <div style="display: flex; gap: 0.25rem; flex-shrink: 0;">
            <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.4rem;" onclick="app.editRehabRule('${rule.id}')" title="Upravit">
              <i data-lucide="edit-3" style="width:12px; height:12px;"></i>
            </button>
            <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.4rem; color: var(--danger-600);" onclick="app.deleteRehabRule('${rule.id}')" title="Smazat">
              <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
            </button>
          </div>
        </div>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  openAddMedicationModal() {
    this.editingMedId = null;
    document.getElementById('modalAddMedTitle').innerText = 'Přidat nový lék';
    document.getElementById('addMedForm').reset();
    this.openModal('modalAddMed');
  }

  openEditMedicationModal(medId) {
    const med = this.medications.find(m => m.id === medId);
    if (!med) return;

    this.editingMedId = medId;
    document.getElementById('modalAddMedTitle').innerText = 'Upravit lék';

    document.getElementById('medNameInput').value = med.name || '';
    document.getElementById('medPurposeInput').value = med.purpose || '';
    document.getElementById('medDosageInput').value = med.dosage || '';
    document.getElementById('medInstructionsInput').value = med.instructions || '';
    document.getElementById('medStockInput').value = med.remainingStock || 30;

    document.getElementById('timingRano').checked = (med.timing || []).includes('rano');
    document.getElementById('timingPoledne').checked = (med.timing || []).includes('poledne');
    document.getElementById('timingVecer').checked = (med.timing || []).includes('vecer');
    document.getElementById('timingNoc').checked = (med.timing || []).includes('noc');

    this.openModal('modalAddMed');
  }

  async saveMedication() {
    const name = document.getElementById('medNameInput').value.trim();
    const purpose = document.getElementById('medPurposeInput').value.trim();
    const dosage = document.getElementById('medDosageInput').value.trim();
    const instructions = document.getElementById('medInstructionsInput').value.trim();
    const stock = parseInt(document.getElementById('medStockInput').value, 10) || 30;

    const timings = [];
    if (document.getElementById('timingRano').checked) timings.push('rano');
    if (document.getElementById('timingPoledne').checked) timings.push('poledne');
    if (document.getElementById('timingVecer').checked) timings.push('vecer');
    if (document.getElementById('timingNoc').checked) timings.push('noc');

    if (this.editingMedId) {
      const med = this.medications.find(m => m.id === this.editingMedId);
      if (med) {
        med.name = name;
        med.purpose = purpose;
        med.dosage = dosage;
        med.timing = timings.length > 0 ? timings : ['rano'];
        med.instructions = instructions;
        med.remainingStock = stock;

        await window.db.save('medications', med);
        await this.syncToFirebase('medications', med.id, med);
      }
    } else {
      const newMed = {
        id: 'med_' + Date.now(),
        name,
        purpose,
        dosage,
        timing: timings.length > 0 ? timings : ['rano'],
        instructions,
        startDate: new Date().toISOString().split('T')[0],
        endDate: 'Dle potřeby',
        checkedToday: false,
        totalStock: stock,
        remainingStock: stock
      };

      await window.db.save('medications', newMed);
      await this.syncToFirebase('medications', newMed.id, newMed);
      this.medications.push(newMed);
    }

    this.closeAllModals();
    this.renderMedications();
    this.updateShareSummaryText();
    this.editingMedId = null;
  }

  async deleteMedication(medId) {
    if (confirm("Opravdu chcete smazat tento lék ze seznamu?")) {
      await window.db.delete('medications', medId);
      await this.syncToFirebase('medications', medId, null, true);
      this.medications = this.medications.filter(m => m.id !== medId);
      this.renderMedications();
      this.updateShareSummaryText();
    }
  }

  async toggleMedicationChecked(medId, checked) {
    const med = this.medications.find(m => m.id === medId);
    if (!med) return;

    med.checkedToday = checked;
    if (checked && med.remainingStock > 0) {
      med.remainingStock -= 1;
    }

    await window.db.save('medications', med);
    await this.syncToFirebase('medications', med.id, med);
    this.renderMedications();
  }

  async editMedStock(medId) {
    const med = this.medications.find(m => m.id === medId);
    if (!med) return;

    const newStock = prompt(`Zadejte novou zásobu tablet/injekcí pro ${med.name}:`, med.remainingStock);
    if (newStock !== null) {
      med.remainingStock = parseInt(newStock, 10) || 0;
      await window.db.save('medications', med);
      this.renderMedications();
    }
  }

  openAddRehabRuleModal() {
    this.editingRuleId = null;
    document.getElementById('modalAddRehabRuleTitle').innerText = 'Přidat bezpečnostní pravidlo';
    document.getElementById('addRehabRuleForm').reset();
    this.openModal('modalAddRehabRule');
  }

  editRehabRule(id) {
    const rule = this.rehabRules.find(r => r.id === id);
    if (!rule) return;

    this.editingRuleId = id;
    document.getElementById('modalAddRehabRuleTitle').innerText = 'Upravit bezpečnostní pravidlo';
    document.getElementById('ruleTitleInput').value = rule.title || '';
    document.getElementById('ruleDescInput').value = rule.desc || '';
    this.openModal('modalAddRehabRule');
  }

  async saveRehabRule() {
    const title = document.getElementById('ruleTitleInput').value.trim();
    const desc = document.getElementById('ruleDescInput').value.trim();

    if (this.editingRuleId) {
      const rule = this.rehabRules.find(r => r.id === this.editingRuleId);
      if (rule) {
        rule.title = title;
        rule.desc = desc;
      }
    } else {
      const newRule = {
        id: 'rule_' + Date.now(),
        title,
        desc,
        type: 'warning'
      };
      this.rehabRules.push(newRule);
    }

    await window.db.save('settings', { key: 'rehabRules', value: this.rehabRules });
    this.closeAllModals();
    this.renderMedications();
    this.editingRuleId = null;
  }

  async deleteRehabRule(id) {
    if (confirm("Opravdu chcete smazat toto pravidlo?")) {
      this.rehabRules = this.rehabRules.filter(r => r.id !== id);
      await window.db.save('settings', { key: 'rehabRules', value: this.rehabRules });
      this.renderMedications();
    }
  }

  // --- Contacts Logic & CRUD ---

  renderContacts() {
    const container = document.getElementById('contactsGrid');
    if (!container) return;

    if (this.contacts.length === 0) {
      container.innerHTML = `<p style="color: var(--slate-600); text-align: center; grid-column: 1/-1; padding: 2rem;">Zatím nebyly zadané žádné kontakty.</p>`;
      return;
    }

    container.innerHTML = this.contacts.map(cnt => `
      <div class="card" style="padding: 1.25rem; margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <h4 style="font-size: 1.1rem; color: var(--slate-900);">${this.escapeHtml(cnt.name)}</h4>
            <div style="font-size: 0.85rem; color: var(--primary-600); font-weight: 600;">${this.escapeHtml(cnt.role)}</div>
            <div style="font-size: 0.8rem; color: var(--slate-600);">${this.escapeHtml(cnt.facility)}</div>
          </div>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.45rem;" onclick="app.openEditContactModal('${cnt.id}')" title="Upravit">
              <i data-lucide="edit-3" style="width:14px; height:14px;"></i>
            </button>
            <button class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.45rem; color: var(--danger-600);" onclick="app.deleteContact('${cnt.id}')" title="Smazat">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </div>

        <div style="font-size: 0.875rem; margin-bottom: 0.75rem;">
          <div style="margin-bottom: 0.25rem;">
            <strong>Tel:</strong> <a href="tel:${cnt.phone}" style="color: var(--accent-600); font-weight: 600;">${this.escapeHtml(cnt.phone)}</a>
          </div>
          ${cnt.email ? `<div><strong>E-mail:</strong> <a href="mailto:${cnt.email}" style="color: var(--accent-600);">${this.escapeHtml(cnt.email)}</a></div>` : ''}
        </div>

        ${cnt.note ? `
          <div style="font-size: 0.8rem; background: var(--slate-50); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); color: var(--slate-700);">
            ${this.escapeHtml(cnt.note)}
          </div>
        ` : ''}
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  openAddContactModal() {
    this.editingContactId = null;
    document.getElementById('modalAddContactTitle').innerText = 'Přidat nový kontakt';
    document.getElementById('addContactForm').reset();
    this.openModal('modalAddContact');
  }

  openEditContactModal(cntId) {
    const cnt = this.contacts.find(c => c.id === cntId);
    if (!cnt) return;

    this.editingContactId = cntId;
    document.getElementById('modalAddContactTitle').innerText = 'Upravit kontakt';

    document.getElementById('cntNameInput').value = cnt.name || '';
    document.getElementById('cntRoleInput').value = cnt.role || '';
    document.getElementById('cntFacilityInput').value = cnt.facility || '';
    document.getElementById('cntPhoneInput').value = cnt.phone || '';
    document.getElementById('cntEmailInput').value = cnt.email || '';
    document.getElementById('cntNoteInput').value = cnt.note || '';

    this.openModal('modalAddContact');
  }

  async saveContact() {
    const name = document.getElementById('cntNameInput').value.trim();
    const role = document.getElementById('cntRoleInput').value.trim();
    const facility = document.getElementById('cntFacilityInput').value.trim();
    const phone = document.getElementById('cntPhoneInput').value.trim();
    const email = document.getElementById('cntEmailInput').value.trim();
    const note = document.getElementById('cntNoteInput').value.trim();

    if (this.editingContactId) {
      const cnt = this.contacts.find(c => c.id === this.editingContactId);
      if (cnt) {
        cnt.name = name;
        cnt.role = role;
        cnt.facility = facility;
        cnt.phone = phone;
        cnt.email = email;
        cnt.note = note;

        await window.db.save('contacts', cnt);
        await this.syncToFirebase('contacts', cnt.id, cnt);
      }
    } else {
      const newCnt = {
        id: 'cnt_' + Date.now(),
        name,
        role,
        facility,
        phone,
        email,
        note
      };

      await window.db.save('contacts', newCnt);
      await this.syncToFirebase('contacts', newCnt.id, newCnt);
      this.contacts.push(newCnt);
    }

    this.closeAllModals();
    this.renderContacts();
    this.editingContactId = null;
  }

  async deleteContact(cntId) {
    if (confirm("Opravdu chcete smazat tento kontakt?")) {
      await window.db.delete('contacts', cntId);
      await this.syncToFirebase('contacts', cntId, null, true);
      this.contacts = this.contacts.filter(c => c.id !== cntId);
      this.renderContacts();
    }
  }

  // --- Dynamic Send & Share Center ---

  updateShareSummaryText() {
    const surgDate = new Date(this.patient.surgeryDate || new Date());
    const today = new Date();
    const diffTime = Math.abs(today - surgDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const latestLog = this.logs[0];
    const painStr = latestLog ? `${latestLog.painLevel}/10 (${latestLog.painLevel <= 3 ? 'Mírná' : 'Vyšší'})` : 'Nezadáno';
    const woundStr = latestLog ? (latestLog.woundStatus || 'Čistá') : 'Nezadáno';
    const mobilityStr = latestLog ? (latestLog.mobility || 'Odpočinek') : 'Nezadáno';

    const medsListStr = this.medications.length > 0 
      ? this.medications.map(m => `- ${m.name}: ${m.dosage}`).join('\n')
      : 'Žádné léky nebyly zadané';

    const nextRem = this.reminders[0];
    const nextAppointmentStr = nextRem ? `${nextRem.date} - ${nextRem.title}` : 'Žádný nejbližší termín';

    const summaryText = 
`SOUHRN ZDRAVOTNÍHO STAVU PACIENTA
------------------------------------
Pacient: ${this.patient.name} (${this.patient.age || '74'} let, nar. ${this.patient.birthDate || '1952'})
Diagnóza: ${this.patient.diagnosis}
Nemocnice: ${this.patient.hospital} | Ošetřující: ${this.patient.attendingDoctor}

AKTUÁLNÍ STAV (${diffDays}. pooperační den):
- Stupeň bolesti: ${painStr}
- Mobilita: ${mobilityStr}
- Stav rány / krytí: ${woundStr}

UŽÍVANÉ LÉKY:
${medsListStr}

NEJBLIŽŠÍ KONTROLA / PLÁN:
- ${nextAppointmentStr}`;

    const textarea = document.getElementById('shareSummaryTextArea');
    if (textarea) {
      textarea.value = summaryText;
    }

    // Update Email Modal Form body as well
    const emailBody = document.getElementById('emailBody');
    if (emailBody) {
      emailBody.value = `Vážený pane doktore,\n\nzasílám aktuální souhrn o zdravotním stavu pacientky ${this.patient.name} (${diffDays}. pooperační den):\n\n- Diagnóza: ${this.patient.diagnosis}\n- Stupeň bolesti: ${painStr}\n- Mobilita: ${mobilityStr}\n- Stav rány: ${woundStr}\n\nLéky:\n${medsListStr}\n\nNejbližší termín: ${nextAppointmentStr}\n\nS pozdravem,\nRodinný pečující`;
    }
  }

  triggerEmailSend() {
    const recipient = document.getElementById('emailRecipient').value.trim();
    const subject = document.getElementById('emailSubject').value.trim();
    const body = document.getElementById('emailBody').value.trim();

    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    this.closeAllModals();
  }

  shareWhatsApp() {
    this.updateShareSummaryText();
    const summaryText = document.getElementById('shareSummaryTextArea')?.value || 
      `Zdravotní souhrn pacienta: ${this.patient.name}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
    window.open(whatsappUrl, '_blank');
  }

  shareSingleDocument(docId) {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    const text = `Dokument/Zpráva: ${doc.title}\nPacient: ${this.patient.name}\nDatum: ${doc.date}\nLékař/Pracoviště: ${doc.facility || doc.doctor}\nSouhrn: ${doc.summary}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  }

  printMedicalReport() {
    window.print();
  }

  // --- Backup Export / Import Sync ---

  async exportBackupJSON() {
    const backupData = {
      patient: this.patient,
      documents: this.documents,
      logs: this.logs,
      medications: this.medications,
      contacts: this.contacts,
      reminders: this.reminders,
      caregivers: this.caregivers,
      rehabRules: this.rehabRules,
      exportDate: new Date().toISOString()
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `CareMom_Zaloha_Zprav_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importBackupJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.documents && imported.logs) {
          if (confirm("Chcete nahradit a synchronizovat všechna data z vybrané zálohy?")) {
            await window.db.clearStore('documents');
            await window.db.clearStore('logs');
            await window.db.clearStore('medications');
            await window.db.clearStore('contacts');
            await window.db.clearStore('settings');

            if (imported.patient) await window.db.save('settings', { key: 'patientProfile', value: imported.patient });
            if (imported.reminders) await window.db.save('settings', { key: 'reminders', value: imported.reminders });
            if (imported.caregivers) await window.db.save('settings', { key: 'caregivers', value: imported.caregivers });
            if (imported.rehabRules) await window.db.save('settings', { key: 'rehabRules', value: imported.rehabRules });

            await window.db.bulkSave('documents', imported.documents);
            await window.db.bulkSave('logs', imported.logs);
            await window.db.bulkSave('medications', imported.medications || INITIAL_MEDICATIONS);
            await window.db.bulkSave('contacts', imported.contacts || INITIAL_CONTACTS);

            await this.loadState();
            this.renderAll();
            alert("Data byla úspěšně obnovena a synchronizována!");
          }
        } else {
          alert("Neplatný formát souboru zálohy.");
        }
      } catch (err) {
        alert("Chyba při čtení souboru zálohy: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  // --- Clear Sample Data Logic ---

  async clearSampleData() {
    if (confirm("Chcete smazat všechna ukázková data (z počítače i z cloudu) a začít s čistým štítem pro vaše reálná data?")) {
      await window.db.clearStore('documents');
      await window.db.clearStore('logs');
      await window.db.clearStore('medications');
      await window.db.clearStore('contacts');
      await window.db.clearStore('settings');

      if (window.firebaseEnabled && window.dbFirestore) {
        try {
          const firestore = window.dbFirestore;
          const cols = ['documents', 'logs', 'medications', 'contacts'];
          for (const c of cols) {
            const snap = await firestore.collection(c).get();
            for (const doc of snap.docs) {
              await firestore.collection(c).doc(doc.id).delete();
            }
          }
          await firestore.collection('app_state').doc('patientProfile').delete();
          await firestore.collection('app_state').doc('reminders').delete();
          await firestore.collection('app_state').doc('caregivers').delete();
          await firestore.collection('app_state').doc('rehabRules').delete();
          console.log("Firestore cloud database wiped.");
        } catch (e) {
          console.error("Error clearing Firestore cloud:", e);
        }
      }

      this.documents = [];
      this.logs = [];
      this.medications = [];
      this.contacts = [];
      this.reminders = [];
      this.caregivers = [];
      this.rehabRules = [];
      
      this.renderAll();
      alert("Ukázková data byla smazána. Nyní máte čistý štít pro vaše reálná data!");
    }
  }

  // --- Helper Utils ---

  openModal(modalId) {
    if (modalId === 'modalShareEmail') {
      this.updateShareSummaryText();
      const subjectInput = document.getElementById('emailSubject');
      if (subjectInput && !subjectInput.value) {
        subjectInput.value = `Souhrn zdravotního stavu: ${this.patient.name}`;
      }
    }
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    this.editingDocId = null;
    this.editingLogId = null;
    this.editingMedId = null;
    this.editingContactId = null;
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getCategoryLabelObj(cat) {
    const map = {
      propousteci: { label: 'Propouštěcí zpráva' },
      rtg: { label: 'RTG / Zobrazovací' },
      fyzioterapie: { label: 'Fyzioterapie & Rehab' },
      recepty: { label: 'Recepty & Léky' },
      ortopedie: { label: 'Ortopedie' },
      ostatni: { label: 'Ostatní dokumenty' }
    };
    return map[cat] || { label: 'Dokument' };
  }

  getLogIcon(cat) {
    const map = {
      leky: 'pill',
      fyzioterapie: 'activity',
      kontrola: 'stethoscope',
      stav: 'heart-pulse'
    };
    return map[cat] || 'clipboard-list';
  }

  getLogCatLabel(cat) {
    const map = {
      leky: 'Léky & Aplikace',
      fyzioterapie: 'Fyzioterapie / Cvičení',
      kontrola: 'Zdravotní stav / Převaz',
      stav: 'Celkový denní stav'
    };
    return map[cat] || 'Péče';
  }

  showSyncStatus(msg, type = 'info') {
    let statusEl = document.getElementById('firebaseStatusBanner');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'firebaseStatusBanner';
      statusEl.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 99999; padding: 12px 18px; border-radius: 10px; font-weight: 600; font-size: 0.9rem; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.3s ease; font-family: Inter, sans-serif; pointer-events: none;';
      document.body.appendChild(statusEl);
    }
    if (type === 'success') {
      statusEl.style.background = '#059669';
      statusEl.style.color = '#ffffff';
    } else if (type === 'error') {
      statusEl.style.background = '#dc2626';
      statusEl.style.color = '#ffffff';
    } else {
      statusEl.style.background = '#2563eb';
      statusEl.style.color = '#ffffff';
    }
    statusEl.innerHTML = msg;
  }

  // --- Firebase Cloud Real-Time Live Sync ---

  async initFirebaseSync() {
    if (!window.firebaseEnabled || !window.dbFirestore) {
      this.showSyncStatus("⚠️ Cloud Firebase nebyl inicializován", "error");
      return;
    }

    this.showSyncStatus("🔄 Načítání dat z cloudu Firebase...", "info");
    const firestore = window.dbFirestore;

    // Listen to Patient Profile
    firestore.collection('app_state').doc('patientProfile').onSnapshot(doc => {
      if (doc.exists && doc.data() && doc.data().name) {
        this.patient = doc.data();
        this.renderPatientHeader();
        this.updateShareSummaryText();
        this.showSyncStatus(`☁️ Cloud připojen: ${this.patient.name}`, "success");
      } else {
        this.showSyncStatus("⚠️ Profil v cloudu zatím chybí. Klikněte na 'Nahrát do cloudu'.", "error");
      }
    }, err => {
      console.error("Firestore Profile snapshot err:", err);
      this.showSyncStatus("❌ Chyba Firebase: " + err.message, "error");
    });

    // Listen to Reminders, Caregivers, Rehab Rules
    firestore.collection('app_state').doc('reminders').onSnapshot(doc => {
      if (doc.exists) { this.reminders = doc.data().items || []; this.renderRemindersAndCaregivers(); }
    }, err => console.error("Firestore Reminders snapshot err:", err));

    firestore.collection('app_state').doc('caregivers').onSnapshot(doc => {
      if (doc.exists) { this.caregivers = doc.data().items || []; this.renderRemindersAndCaregivers(); }
    }, err => console.error("Firestore Caregivers snapshot err:", err));

    firestore.collection('app_state').doc('rehabRules').onSnapshot(doc => {
      if (doc.exists) { this.rehabRules = doc.data().items || []; this.renderMedications(); }
    }, err => console.error("Firestore RehabRules snapshot err:", err));

    // Listen to Documents
    firestore.collection('documents').onSnapshot(snapshot => {
      const docs = [];
      snapshot.forEach(docSnap => {
        const cloudDoc = docSnap.data();
        const localDoc = this.documents.find(d => d.id === cloudDoc.id);
        if (localDoc && localDoc.fileData && !cloudDoc.fileData) {
          cloudDoc.fileData = localDoc.fileData;
        }
        docs.push(cloudDoc);
      });
      this.documents = docs;
      window.db.clearStore('documents').then(() => {
        if (docs.length > 0) window.db.bulkSave('documents', docs);
      });
      this.renderDocuments();
      this.renderPatientHeader();
    }, err => console.error("Firestore Documents snapshot err:", err));

    // Listen to Care Logs
    firestore.collection('logs').onSnapshot(snapshot => {
      const logs = [];
      snapshot.forEach(doc => logs.push(doc.data()));
      this.logs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      window.db.clearStore('logs').then(() => {
        if (logs.length > 0) window.db.bulkSave('logs', logs);
      });
      this.renderCareLogs();
      this.renderPatientHeader();
      this.updateShareSummaryText();
    }, err => console.error("Firestore Logs snapshot err:", err));

    // Listen to Medications
    firestore.collection('medications').onSnapshot(snapshot => {
      const meds = [];
      snapshot.forEach(doc => meds.push(doc.data()));
      this.medications = meds;
      window.db.clearStore('medications').then(() => {
        if (meds.length > 0) window.db.bulkSave('medications', meds);
      });
      this.renderMedications();
    }, err => console.error("Firestore Meds snapshot err:", err));

    // Listen to Contacts
    firestore.collection('contacts').onSnapshot(snapshot => {
      const cnts = [];
      snapshot.forEach(doc => cnts.push(doc.data()));
      this.contacts = cnts;
      window.db.clearStore('contacts').then(() => {
        if (cnts.length > 0) window.db.bulkSave('contacts', cnts);
      });
      this.renderContacts();
    }, err => console.error("Firestore Contacts snapshot err:", err));
  }

  sanitizeDocForFirebase(doc) {
    const copy = { ...doc };
    // Firestore has a 1,048,576 byte limit per document. If fileData base64 is larger than ~900KB, omit fileData in cloud sync
    if (copy.fileData && copy.fileData.length > 900000) {
      copy.fileDataOverLimit = true;
      copy.fileDataNotice = "Soubor přesahuje 1 MB limit Firestore (zobrazí se na zařízení autora)";
      copy.fileData = null;
    }
    return copy;
  }

  async pushAllLocalToFirebase() {
    if (!window.firebaseEnabled || !window.dbFirestore) {
      alert("⚠️ Firebase není připojen!");
      return false;
    }
    try {
      const firestore = window.dbFirestore;
      await firestore.collection('app_state').doc('patientProfile').set(this.patient);
      await firestore.collection('app_state').doc('reminders').set({ items: this.reminders });
      await firestore.collection('app_state').doc('caregivers').set({ items: this.caregivers });
      await firestore.collection('app_state').doc('rehabRules').set({ items: this.rehabRules });

      for (const doc of this.documents) {
        const safeDoc = this.sanitizeDocForFirebase(doc);
        await firestore.collection('documents').doc(doc.id).set(safeDoc);
      }
      for (const log of this.logs) {
        await firestore.collection('logs').doc(log.id).set(log);
      }
      for (const med of this.medications) {
        await firestore.collection('medications').doc(med.id).set(med);
      }
      for (const cnt of this.contacts) {
        await firestore.collection('contacts').doc(cnt.id).set(cnt);
      }
      console.log("✅ All local data successfully pushed to Firestore!");
      return true;
    } catch (err) {
      console.error("Firebase upload error:", err);
      alert("⚠️ Chyba při odesílání do Firebase: " + err.message);
      return false;
    }
  }

  async pushAllLocalToFirebaseWithAlert() {
    const success = await this.pushAllLocalToFirebase();
    if (success) {
      alert("✅ Všechna vaše data byla úspěšně nahrána do cloudu! Nyní budou ihned vidět v anonymním okně i pro ostatní příbuzné.");
    }
  }

  async syncToFirebase(collectionName, docId, data, isDelete = false) {
    if (!window.firebaseEnabled || !window.dbFirestore) return;
    try {
      if (isDelete) {
        await window.dbFirestore.collection(collectionName).doc(docId).delete();
      } else {
        const safeData = collectionName === 'documents' ? this.sanitizeDocForFirebase(data) : data;
        await window.dbFirestore.collection(collectionName).doc(docId).set(safeData);
      }
    } catch (err) {
      console.error("Firebase sync error:", err);
    }
  }

  getTimingLabel(timing) {
    const map = { rano: 'Ráno 08:00', poledne: 'Poledne 12:00', vecer: 'Večer 20:00', noc: 'Noc 22:00' };
    return map[timing] || timing;
  }
}

// Global App Instance
window.app = new CareMomApp();
document.addEventListener('DOMContentLoaded', () => window.app.init());
