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
        header.forEach((h,i) => obj[h] = (cols[i] ?? '').trim());
        return obj;
      });

      function parseCSVLine(line){
        const out = [];
        let cur = '';
        let inQuotes = false;
        for(let i=0;i<line.length;i++){
          const ch = line[i];
          if(inQuotes){
            if(ch === '"'){
              if(i+1 < line.length && line[i+1] === '"'){
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

      if(parts.length <= 1){
        const one = parts[0] || '';
        return `<div class="sys-stack"><span class="sys-chip">${escapeHtml(one)}</span></div>`;
      }

      return `<div class="sys-stack">${parts.map(p => `<span class="sys-chip">${escapeHtml(p)}</span>`).join('')}</div>`;
    }

    function initApp(){
      const svg = document.getElementById('sachsenMap');
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

      const DATA_CATALOG = window.DATA_CATALOG || {};
      const CONTACTS = {
        saechsisch:              { name: '', email: '' },
        erzgebirge:              { name: '', email: '' },
        oberlausitz:             { name: '', email: '' },
        leipzig:                 { name: '', email: '' },
        leipzig_stadt:           { name: '', email: '' },
        dresden:                 { name: '', email: '' },
        dresden_stadt:           { name: '', email: '' },
        chemnitz_zwickau_region: { name: '', email: '' },
        chemnitz_stadt:          { name: '', email: '' },
        vogtland:                { name: '', email: '' }
      };

      const regions = Array.from(svg.querySelectorAll('g.region[id]'));
      let activeId = null;

      function renderDataPopup(regionId, regionName){
        const rows = DATA_CATALOG[regionId] || [];
        dataPopupTitle.textContent = `Datenübersicht: ${regionName}`;
        dataPopupHint.textContent = rows.length
          ? 'Übersicht der Datenarten und des Pflegesystems für diese Region.'
          : 'Für diese Region sind noch keine Datenarten hinterlegt.';
        dataPopupList.innerHTML = rows.map(r => `
          <div class="data-row">
            <div class="type-chip">${escapeHtml(r.type)}</div>
            <div class="data-sys">${formatSystem(r.system)}</div>
          </div>
        `).join('');
        dataPopup.classList.add('is-open');
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
        if (x + rect.width + pad > vw) x = clientX - rect.width - pad;
        if (y + rect.height + pad > vh) y = clientY - rect.height - pad;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
      }

      function hideTooltip(){
        tooltip.style.transform = 'translate(-9999px, -9999px)';
      }

      function svgToLocalPoint(evt){
        const pt = svg.createSVGPoint();
        pt.x = evt.clientX;
        pt.y = evt.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const local = pt.matrixTransform(ctm.inverse());
        return { x: local.x, y: local.y };
      }

      function pickRegion(evt){
        const p = svgToLocalPoint(evt);
        const chemnitzCityPath = document.querySelector('#chemnitz_stadt path.flaeche');
        if (chemnitzCityPath && chemnitzCityPath.isPointInFill && chemnitzCityPath.isPointInFill(p)) {
          return document.getElementById('chemnitz_stadt');
        }
        const leipzigCityPath = document.querySelector('#leipzig_stadt path.flaeche');
        if (leipzigCityPath && leipzigCityPath.isPointInFill && leipzigCityPath.isPointInFill(p)) {
          return document.getElementById('leipzig_stadt');
        }
        const hit = evt.target.closest('path.flaeche, path.hit');
        return hit ? hit.closest('g.region') : null;
      }

      function clearSelection(){
        activeId = null;
        svg.classList.remove('has-selection');
        regions.forEach(g => g.classList.remove('is-active'));
        selectedName.textContent = 'Keine Region gewählt';
        selectedMeta.textContent = 'Klicke auf eine Fläche in der Karte.';
        openBtn.disabled = true;
        openBtn.onclick = null;
        contactCard.style.display = 'none';
        contactName.textContent = 'Ansprechpartner: –';
        contactEmail.textContent = 'E-Mail: –';
        closeDataPopup();
      }

      function selectById(id){
        if (activeId === id) {
          clearSelection();
          return;
        }
        const g = regions.find(x => x.id === id);
        if (!g) return;

        activeId = id;
        svg.classList.add('has-selection');
        regions.forEach(x => x.classList.toggle('is-active', x.id === id));

        const name = g.dataset.name || g.id;
        const url = g.dataset.url || '';
        selectedName.textContent = name;
        selectedMeta.textContent = '';

        const c = CONTACTS[id] || {};
        contactName.textContent = `Ansprechpartner: ${c.name || '–'}`;
        contactEmail.textContent = `E-Mail: ${c.email || '–'}`;
        contactCard.style.display = 'block';

        renderDataPopup(g.id, name);

        openBtn.disabled = !url;
        openBtn.onclick = () => {
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        };
      }

      (function fitViewBox(){
        const bbox = svg.getBBox();
        const pad = 20;
        svg.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad*2} ${bbox.height + pad*2}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      })();

      svg.addEventListener('pointermove', (e) => {
        const p = e.target.closest('path.flaeche, path.hit');
        if (!p) return;
        const g = p.closest('g.region[id]');
        if (!g) return;
        const name = g.dataset.name || g.id;
        const hint = activeId && activeId !== g.id ? 'Klicken zum Wechseln' : 'Klicken zum Auswählen';
        showTooltip(name, hint);
        moveTooltip(e.clientX, e.clientY);
      });

      svg.addEventListener('pointerover', (e) => {
        const p = e.target.closest('path.flaeche, path.hit');
        if (!p) return;
        const g = p.closest('g.region[id]');
        if (g) g.classList.add('is-hover');
      });

      svg.addEventListener('pointerout', (e) => {
        const g = e.target.closest('g.region[id]');
        if (g) g.classList.remove('is-hover');
        const related = e.relatedTarget;
        if (!related || !svg.contains(related)) hideTooltip();
      });

      svg.addEventListener('click', (e) => {
        const g = pickRegion(e);
        if (!g) return;
        selectById(g.id);
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') clearSelection();
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
        byRegion[id].push({ type: r.datenart, system: r.system });
      }
      window.DATA_CATALOG = byRegion;

      initApp();
    }

    document.addEventListener('DOMContentLoaded', () => {
      boot().catch(err => console.error(err));
    });
