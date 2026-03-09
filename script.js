(function () {
  const mapHost = document.getElementById('mapHost');
  const tooltip = document.getElementById('tooltip');
  const selectedName = document.getElementById('selectedName');
  const selectedMeta = document.getElementById('selectedMeta');
  const clearBtn = document.getElementById('clearBtn');
  const openBtn = document.getElementById('openBtn');
  const dataPopup = document.getElementById('dataPopup');
  const dataPopupTitle = document.getElementById('dataPopupTitle');
  const dataPopupHint = document.getElementById('dataPopupHint');
  const dataPopupList = document.getElementById('dataPopupList');
  const contactCard = document.getElementById('contactCard');
  const contactName = document.getElementById('contactName');
  const contactEmail = document.getElementById('contactEmail');

  const CONTACTS = {
    saechsisch: { name: '', email: '' },
    erzgebirge: { name: '', email: '' },
    oberlausitz: { name: '', email: '' },
    leipzig: { name: '', email: '' },
    leipzig_stadt: { name: '', email: '' },
    dresden: { name: '', email: '' },
    dresden_stadt: { name: '', email: '' },
    chemnitz_zwickau_region: { name: '', email: '' },
    chemnitz_stadt: { name: '', email: '' },
    vogtland: { name: '', email: '' }
  };

  let svg;
  let regions = [];
  let dataCatalog = {};
  let activeId = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function formatSystem(system) {
    const parts = String(system || '').split(',');
    const main = (parts.shift() || '').trim();
    const rest = parts.join(',').trim();

    if (!rest) {
      return `
        <div class="sys-stack">
          <span class="sys-chip">${escapeHtml(main)}</span>
        </div>
      `;
    }

    return `
      <div class="sys-stack">
        <span class="sys-chip">${escapeHtml(main)}</span>
        <span class="sys-chip sys-sub-chip">${escapeHtml(rest)}</span>
      </div>
    `;
  }

  function showTooltip(text, sub) {
    tooltip.innerHTML = `<strong>${escapeHtml(text)}</strong>${sub ? `<span class="muted">${escapeHtml(sub)}</span>` : ''}`;
    tooltip.style.transform = 'translate(0, 0)';
  }

  function moveTooltip(clientX, clientY) {
    const pad = 14;
    const rect = tooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + rect.width + pad > vw) x = clientX - rect.width - pad;
    if (y + rect.height + pad > vh) y = clientY - rect.height - pad;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function hideTooltip() {
    tooltip.style.transform = 'translate(-9999px, -9999px)';
  }

  function closeDataPopup() {
    dataPopup.classList.remove('is-open');
  }

  function renderDataPopup(regionId, regionName) {
    const rows = dataCatalog[regionId] || [];
    dataPopupTitle.textContent = `Datenübersicht: ${regionName}`;
    dataPopupHint.textContent = rows.length
      ? 'Übersicht der Datenarten und des Pflegesystems für diese Region.'
      : 'Für diese Region sind noch keine Datenarten hinterlegt.';

    dataPopupList.innerHTML = rows.map((row) => `
      <div class="data-row">
        <div class="type-chip">${escapeHtml(row.type)}</div>
        <div class="data-sys">${formatSystem(row.system)}</div>
      </div>
    `).join('');

    dataPopup.classList.add('is-open');
  }

  function clearSelection() {
    activeId = null;
    if (svg) svg.classList.remove('has-selection');
    regions.forEach((region) => region.classList.remove('is-active'));
    selectedName.textContent = 'Keine Region gewählt';
    selectedMeta.textContent = 'Klicke auf eine Fläche in der Karte.';
    openBtn.disabled = true;
    openBtn.onclick = null;

    if (contactCard) contactCard.style.display = 'none';
    if (contactName) contactName.textContent = 'Ansprechpartner: –';
    if (contactEmail) contactEmail.textContent = 'E-Mail: –';

    closeDataPopup();
  }

  function selectById(id) {
    if (activeId === id) {
      clearSelection();
      return;
    }

    const region = regions.find((entry) => entry.id === id);
    if (!region) return;

    activeId = id;
    svg.classList.add('has-selection');
    regions.forEach((entry) => entry.classList.toggle('is-active', entry.id === id));

    const name = region.dataset.name || region.id;
    const url = region.dataset.url || '';

    selectedName.textContent = name;
    selectedMeta.textContent = '';

    const contact = CONTACTS[id] || {};
    if (contactName) contactName.textContent = `Ansprechpartner: ${contact.name || '–'}`;
    if (contactEmail) contactEmail.textContent = `E-Mail: ${contact.email || '–'}`;
    if (contactCard) contactCard.style.display = 'block';

    renderDataPopup(id, name);

    openBtn.disabled = !url;
    openBtn.onclick = () => {
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };
  }

  function parseCsv(text) {
    const rows = [];
    let current = '';
    let row = [];
    let inQuotes = false;
    const raw = text.replace(/^\uFEFF/, '');

    function pushField() {
      row.push(current);
      current = '';
    }

    function pushRow() {
      rows.push(row);
      row = [];
    }

    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i];
      const next = raw[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        pushField();
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        pushField();
        pushRow();
      } else {
        current += char;
      }
    }

    if (current.length || row.length) {
      pushField();
      pushRow();
    }

    const cleaned = rows.filter((entry) => entry.length && entry.some((cell) => cell !== ''));
    const [header, ...bodyRows] = cleaned;
    return bodyRows.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] || ''])));
  }

  function buildCatalog(csvRows) {
    const catalog = {};
    csvRows.forEach((row) => {
      if (!catalog[row.region_id]) catalog[row.region_id] = [];
      catalog[row.region_id].push({
        type: row.datenart,
        system: row.system
      });
    });
    return catalog;
  }

  function svgToLocalPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = point.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function pickRegion(event) {
    const point = svgToLocalPoint(event);

    const chemnitzCityPath = svg.querySelector('#chemnitz_stadt path.flaeche');
    if (chemnitzCityPath && typeof chemnitzCityPath.isPointInFill === 'function' && chemnitzCityPath.isPointInFill(point)) {
      return svg.querySelector('#chemnitz_stadt');
    }

    const leipzigCityPath = svg.querySelector('#leipzig_stadt path.flaeche');
    if (leipzigCityPath && typeof leipzigCityPath.isPointInFill === 'function' && leipzigCityPath.isPointInFill(point)) {
      return svg.querySelector('#leipzig_stadt');
    }

    const hit = event.target.closest('path.flaeche, path.hit');
    return hit ? hit.closest('g.region') : null;
  }

  function wireEvents() {
    regions = Array.from(svg.querySelectorAll('g.region[id]'));

    try {
      const bbox = svg.getBBox();
      const pad = 20;
      svg.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    } catch (error) {
      console.warn('viewBox konnte nicht automatisch gesetzt werden.', error);
    }

    svg.addEventListener('pointermove', (event) => {
      const path = event.target.closest('path.flaeche, path.hit');
      if (!path) return;
      const region = path.closest('g.region[id]');
      if (!region) return;
      const name = region.dataset.name || region.id;
      const hint = activeId && activeId !== region.id ? 'Klicken zum Wechseln' : 'Klicken zum Auswählen';
      showTooltip(name, hint);
      moveTooltip(event.clientX, event.clientY);
    });

    svg.addEventListener('pointerover', (event) => {
      const path = event.target.closest('path.flaeche, path.hit');
      if (!path) return;
      const region = path.closest('g.region[id]');
      if (region) region.classList.add('is-hover');
    });

    svg.addEventListener('pointerout', (event) => {
      const region = event.target.closest('g.region[id]');
      if (region) region.classList.remove('is-hover');
      const related = event.relatedTarget;
      if (!related || !svg.contains(related)) hideTooltip();
    });

    svg.addEventListener('click', (event) => {
      const region = pickRegion(event);
      if (!region) return;
      selectById(region.id);
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') clearSelection();
    });

    clearBtn.addEventListener('click', clearSelection);
    clearSelection();
  }

  async function init() {
    try {
      const [svgResponse, csvResponse] = await Promise.all([
        fetch('sachsenkarte.svg'),
        fetch('datenpopup.csv')
      ]);

      if (!svgResponse.ok) throw new Error(`SVG konnte nicht geladen werden (${svgResponse.status}).`);
      if (!csvResponse.ok) throw new Error(`CSV konnte nicht geladen werden (${csvResponse.status}).`);

      const [svgText, csvText] = await Promise.all([
        svgResponse.text(),
        csvResponse.text()
      ]);

      mapHost.innerHTML = svgText;
      svg = mapHost.querySelector('#sachsenMap');

      if (!svg) {
        throw new Error('Im SVG wurde kein Element mit der ID "sachsenMap" gefunden.');
      }

      dataCatalog = buildCatalog(parseCsv(csvText));
      wireEvents();
    } catch (error) {
      console.error(error);
      mapHost.innerHTML = `<div class="status">Fehler beim Laden der Karte: ${escapeHtml(error.message)}</div>`;
      selectedMeta.textContent = 'Die externen Dateien konnten nicht vollständig geladen werden.';
    }
  }

  init();
})();
