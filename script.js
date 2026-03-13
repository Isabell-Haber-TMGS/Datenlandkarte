async function loadText(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
  return await res.text();
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if(!lines.length) return [];

  const header = parseCSVLine(lines.shift());

  return lines.map(line => {
    const cols = parseCSVLine(line);
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = (cols[i] ?? '').trim();
    });
    return obj;
  });

  function parseCSVLine(line){
    const out = [];
    let cur = '';
    let inQuotes = false;

    for(let i = 0; i < line.length; i++){
      const ch = line[i];

      if(inQuotes){
        if(ch === '"'){
          if(i + 1 < line.length && line[i + 1] === '"'){
            cur += '"';
            i++;
          }else{
            inQuotes = false;
          }
        }else{
          cur += ch;
        }
      }else{
        if(ch === '"'){
          inQuotes = true;
        }else if(ch === ','){
          out.push(cur);
          cur = '';
        }else{
          cur += ch;
        }
      }
    }

    out.push(cur);
    return out;
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}

function sanitizeValue(v){
  let s = String(v ?? '').trim();
  s = s.replace(/^[\\"'“”]+/, '').replace(/[\\"'“”]+$/, '').trim();
  return s;
}

function formatSystem(sys){
  let raw = sanitizeValue(sys);

  raw = raw
    .replace(/\s+und\s+/gi, ', ')
    .replace(/\s+bzw\.\s+/gi, ', ')
    .replace(/\s*&\s*/g, ', ')
    .replace(/\s*\|\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s*\/\s*/g, ', ');

  const parts = raw.split(',').map(s => sanitizeValue(s)).filter(Boolean);

  return `
    <div class="data-sys">
      ${parts.map(p => `<span class="sys-chip">${escapeHtml(p)}</span>`).join('')}
    </div>
  `;
}

function initApp(){
  const svg = document.getElementById('sachsenMap');
  if(!svg){
    throw new Error('SVG mit id="sachsenMap" nicht gefunden.');
  }

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
  const contactList = document.getElementById('contactList');

  const leipzigModeSwitch = document.getElementById('leipzigModeSwitch');
  const modeConventionBtn = document.getElementById('modeConventionBtn');
  const modeOnlineBtn = document.getElementById('modeOnlineBtn');

  const DATA_CATALOG = window.DATA_CATALOG || {};

  const CONTACTS = {
    saechsisch: [
      { name: 'Mandy Krebs', role: 'Aufgabengebiet ergänzen', email: 'mandy@example.de' },
      { name: 'Yvonne Brückner', role: 'Aufgabengebiet ergänzen', email: 'yvonne@example.de' }
    ],
    erzgebirge: [
      { name: 'Alexander Ohly', role: 'Aufgabengebiet ergänzen', email: 'alexander@example.de' }
    ],
    oberlausitz: [
      { name: 'Teresa Kalauch', role: 'Aufgabengebiet ergänzen', email: 'teresa@example.de' },
      { name: 'Anne Heidrich', role: 'Aufgabengebiet ergänzen', email: 'anne@example.de' }
    ],
    leipzig: [
      { name: 'Verena Daser', role: 'Aufgabengebiet ergänzen', email: 'verena@example.de' },
      { name: 'Christina Witt', role: 'Aufgabengebiet ergänzen', email: '' },
    ],
    leipzig_stadt: [
      { name: 'Anna Findeisen', role: 'Aufgabengebiet ergänzen', email: '' },
      { name: 'Hiskia Wiesner', role: 'Aufgabengebiet ergänzen', email: '' },
      { name: 'Christina Witt', role: 'Aufgabengebiet ergänzen', email: '' }
    ],
    dresden: [
      { name: 'Sindy Vogel', role: 'Aufgabengebiet ergänzen', email: 'sindy@example.de' },
      { name: 'Ulrike Friedl-von Thun', role: 'Aufgabengebiet ergänzen', email: 'ulrike@example.de' }
    ],
    dresden_stadt: [
      { name: 'Yvonne Seidemann', role: 'Tourismus', email: 'yvonne@example.de' },
      { name: 'Katharina Böhme', role: 'Convention', email: 'katharina@example.de' }
    ],
    chemnitz_zwickau_region: [
      { name: 'Benjamin Schreiter', role: 'Aufgabengebiet ergänzen', email: 'benjamin@example.de' },
      { name: 'Anna Kunke', role: 'Aufgabengebiet ergänzen', email: 'anna.k@example.de' }
    ],
    chemnitz_stadt: [],
    vogtland: [
      { name: 'Laura Trommer', role: 'Aufgabengebiet ergänzen', email: 'laura@example.de' }
    ]
  };

  const URLS = {
    oberlausitz: 'https://www.oberlausitz.com',
    leipzig: 'https://www.leipzig.travel',
    leipzig_stadt: 'https://www.leipzig.travel',
    dresden: 'https://www.dresden-elbland.de',
    dresden_stadt: 'https://www.dresden.de',
    vogtland: 'https://www.vogtland-tourismus.de',
    saechsisch: 'https://www.saechsische-schweiz.de',
    erzgebirge: 'https://www.erzgebirge-tourismus.de',
    chemnitz_zwickau_region: 'https://chemnitz-zwickau-region.de',
    chemnitz_stadt: 'https://www.chemnitz.travel'
  };

  const LEIPZIG_STADT_MODES = {
    convention: {
      label: 'Convention',
      website: 'https://www.leipzig-convention.de',
      contacts: [
        { name: 'Anna Findeisen', role: 'Aufgabengebiet ergänzen', email: '' },
        { name: 'Hiskia Wiesner', role: 'Aufgabengebiet ergänzen', email: '' }
      ]
    },
    online: {
      label: 'Online-Abteilung',
      website: 'https://www.leipzig.travel',
      contacts: [
        { name: 'Jamina Mertz', role: 'Aufgabengebiet ergänzen', email: '' },
        { name: 'Daniel Almendinger', role: 'Aufgabengebiet ergänzen', email: '' }
      ]
    }
  };

  const regions = Array.from(svg.querySelectorAll('g.region[id]'));
  let activeId = null;
  let activeLeipzigMode = 'convention';

  function renderContacts(contacts){
    if(!contacts || !contacts.length){
      contactCard.style.display = 'none';
      if(contactList) contactList.innerHTML = '';
      return;
    }

    contactList.innerHTML = contacts.map(person => `
      <div class="contact-item">
        <div class="contact-person">${escapeHtml(person.name || '–')}</div>
        <div class="contact-role">${escapeHtml(person.role || '–')}</div>
        <div class="contact-mail">
          ${person.email
            ? `<a href="mailto:${escapeHtml(person.email)}">${escapeHtml(person.email)}</a>`
            : '–'}
        </div>
      </div>
    `).join('');

    contactCard.style.display = 'block';
  }

  function renderRows(rows, title, hint){
    dataPopupTitle.textContent = title;
    dataPopupHint.textContent = hint;

    dataPopupList.innerHTML = rows.map(r => `
      <div class="data-row">
        <div class="data-type">${escapeHtml(r.type || r.datenart || '–')}</div>
        ${formatSystem(r.system || '')}
      </div>
    `).join('');

    dataPopup.classList.add('is-open');
  }

  function renderDataPopup(regionId, regionName){
    const rows = DATA_CATALOG[regionId] || [];

    renderRows(
      rows,
      `Datenübersicht: ${regionName}`,
      rows.length
        ? 'Übersicht der Datenarten und des Pflegesystems für diese Region.'
        : 'Für diese Region sind noch keine Datenarten hinterlegt.'
    );
  }

  function renderLeipzigStadtMode(mode){
    const config = LEIPZIG_STADT_MODES[mode];
    if(!config) return;

    activeLeipzigMode = mode;

    if(leipzigModeSwitch){
      leipzigModeSwitch.hidden = false;
    }

    if(modeConventionBtn){
      modeConventionBtn.classList.toggle('is-active', mode === 'convention');
    }
    if(modeOnlineBtn){
      modeOnlineBtn.classList.toggle('is-active', mode === 'online');
    }

    selectedName.textContent = 'Leipzig (Stadt)';
    selectedMeta.textContent = config.label;

    renderContacts(config.contacts || []);

    const allRows = DATA_CATALOG['leipzig_stadt'] || [];
    const filteredRows = allRows.filter(r => (r.mode || '') === mode);

    renderRows(
      filteredRows,
      `Datenübersicht: Leipzig (Stadt) – ${config.label}`,
      filteredRows.length
        ? 'Übersicht der Datenarten und des Pflegesystems für diese Einheit.'
        : 'Für diese Ansicht sind noch keine Daten hinterlegt.'
    );

    if(config.website){
      openBtn.hidden = false;
      openBtn.disabled = false;
      openBtn.onclick = () => {
        window.open(config.website, '_blank', 'noopener,noreferrer');
      };
    }else{
      openBtn.hidden = true;
      openBtn.disabled = true;
      openBtn.onclick = null;
    }
  }

  function closeDataPopup(){
    dataPopup.classList.remove('is-open');
  }

  function showTooltip(text, sub){
    tooltip.innerHTML = `<strong>${escapeHtml(text)}</strong>${sub ? `<span class="muted">${escapeHtml(sub)}</span>` : ''}`;
    tooltip.style.transform = 'translate(0,0)';
  }

  function moveTooltip(clientX, clientY){
    const pad = 10;
    const rect = tooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = clientX + pad;
    let y = clientY + pad;

    if(x + rect.width + pad > vw) x = clientX - rect.width - pad;
    if(y + rect.height + pad > vh) y = clientY - rect.height - pad;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function hideTooltip(){
    tooltip.style.transform = 'translate(-9999px, -9999px)';
  }

  function svgToLocalPoint(evt){
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if(!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  }

  function pickRegion(evt){
    const p = svgToLocalPoint(evt);

    const chemnitzCityPath = document.querySelector('#chemnitz_stadt path.flaeche');
    if(chemnitzCityPath && chemnitzCityPath.isPointInFill && chemnitzCityPath.isPointInFill(p)){
      return document.getElementById('chemnitz_stadt');
    }

    const leipzigCityPath = document.querySelector('#leipzig_stadt path.flaeche');
    if(leipzigCityPath && leipzigCityPath.isPointInFill && leipzigCityPath.isPointInFill(p)){
      return document.getElementById('leipzig_stadt');
    }

    const hit = evt.target.closest('path.flaeche, path.hit');
    return hit ? hit.closest('g.region') : null;
  }

  function clearSelection(){
    activeId = null;
    activeLeipzigMode = 'convention';

    svg.classList.remove('has-selection');
    regions.forEach(g => g.classList.remove('is-active'));

    selectedName.textContent = 'Keine Region gewählt';
    selectedMeta.textContent = 'Klicke auf eine Fläche in der Karte.';

    openBtn.hidden = true;
    openBtn.disabled = true;
    openBtn.onclick = null;

    if(leipzigModeSwitch){
      leipzigModeSwitch.hidden = true;
    }

    if(modeConventionBtn){
      modeConventionBtn.classList.add('is-active');
    }
    if(modeOnlineBtn){
      modeOnlineBtn.classList.remove('is-active');
    }

    contactCard.style.display = 'none';
    if(contactList) contactList.innerHTML = '';

    closeDataPopup();
  }

  function selectById(id){
    if(activeId === id){
      clearSelection();
      return;
    }

    const g = regions.find(x => x.id === id);
    if(!g) return;

    activeId = id;
    svg.classList.add('has-selection');
    regions.forEach(x => x.classList.toggle('is-active', x.id === id));

    const name = g.dataset.name || g.id;
    const url = g.dataset.url || URLS[id] || '';

    if(id === 'leipzig_stadt'){
      if(leipzigModeSwitch){
        leipzigModeSwitch.hidden = false;
      }
      renderLeipzigStadtMode(activeLeipzigMode);
      return;
    }else{
      if(leipzigModeSwitch){
        leipzigModeSwitch.hidden = true;
      }
    }

    selectedName.textContent = name;
    selectedMeta.textContent = '';

    const contacts = CONTACTS[id] || [];
    renderContacts(contacts);

    renderDataPopup(g.id, name);

    if(url){
      openBtn.hidden = false;
      openBtn.disabled = false;
      openBtn.onclick = () => {
        window.open(url, '_blank', 'noopener,noreferrer');
      };
    }else{
      openBtn.hidden = true;
      openBtn.disabled = true;
      openBtn.onclick = null;
    }
  }

  if(modeConventionBtn){
    modeConventionBtn.addEventListener('click', () => {
      if(activeId === 'leipzig_stadt'){
        if(leipzigModeSwitch){
          leipzigModeSwitch.hidden = false;
        }
        renderLeipzigStadtMode('convention');
      }
    });
  }

  if(modeOnlineBtn){
    modeOnlineBtn.addEventListener('click', () => {
      if(activeId === 'leipzig_stadt'){
        if(leipzigModeSwitch){
          leipzigModeSwitch.hidden = false;
        }
        renderLeipzigStadtMode('online');
      }
    });
  }

  (function fitViewBox(){
    const bbox = svg.getBBox();
    const pad = 20;
    svg.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  })();

  svg.addEventListener('pointermove', (e) => {
    const p = e.target.closest('path.flaeche, path.hit');
    if(!p) return;

    const g = p.closest('g.region[id]');
    if(!g) return;

    const name = g.dataset.name || g.id;
    const hint = activeId && activeId !== g.id ? 'Klicken zum Wechseln' : 'Klicken zum Auswählen';

    showTooltip(name, hint);
    moveTooltip(e.clientX, e.clientY);
  });

  svg.addEventListener('pointerover', (e) => {
    const p = e.target.closest('path.flaeche, path.hit');
    if(!p) return;

    const g = p.closest('g.region[id]');
    if(g) g.classList.add('is-hover');
  });

  svg.addEventListener('pointerout', (e) => {
    const g = e.target.closest('g.region[id]');
    if(g) g.classList.remove('is-hover');

    const related = e.relatedTarget;
    if(!related || !svg.contains(related)) hideTooltip();
  });

  svg.addEventListener('click', (e) => {
    const g = pickRegion(e);
    if(!g) return;
    selectById(g.id);
  });

  window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') clearSelection();
  });

  clearBtn.addEventListener('click', clearSelection);
  clearSelection();
}

async function boot(){
  const svgText = await loadText('sachsenkarte.svg');
  document.getElementById('mapWrap').innerHTML = svgText;

  const csvText = await loadText('datenpopup.csv');
  const rows = parseCSV(csvText);

  const byRegion = {};
  for(const r of rows){
    const id = r.region_id;
    if(!byRegion[id]) byRegion[id] = [];
    byRegion[id].push({
      mode: (r.mode || '').trim().toLowerCase(),
      type: r.datenart || r.type || '',
      system: r.system || ''
    });
  }

  window.DATA_CATALOG = byRegion;

  initApp();
}

document.addEventListener('DOMContentLoaded', () => {
  boot().catch(err => console.error(err));
});
