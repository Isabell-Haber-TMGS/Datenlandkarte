
async function loadText(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('Fetch failed: '+url);
  return await res.text();
}

function parseCSV(text){
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  const header=lines.shift().split(',');
  return lines.map(l=>{
    const cols=l.split(',');
    const obj={};
    header.forEach((h,i)=>obj[h]=cols[i]);
    return obj;
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function normalizeSystemChipWidths(){
  const stacks=[...document.querySelectorAll('#dataPopupList .sys-stack')];
  let max=0;
  const chips=[];

  stacks.forEach(s=>{
    [...s.querySelectorAll('.sys-chip')].forEach(c=>{
      c.style.width='auto';
      chips.push(c);
      max=Math.max(max,c.offsetWidth);
    });
  });

  chips.forEach(c=>c.style.width=max+'px');
}

function formatSystem(sys){
  const parts=sys.split(/[,\/]/).map(s=>s.trim()).filter(Boolean);
  return `<div class="sys-stack">${
    parts.map(p=>`<span class="sys-chip">${escapeHtml(p)}</span>`).join('')
  }</div>`;
}

function renderDataPopup(rows){
  const list=document.getElementById('dataPopupList');

  list.innerHTML=rows.map(r=>`
    <div class="data-row">
      <div class="type-chip">${escapeHtml(r.datenart)}</div>
      <div class="data-sys">${formatSystem(r.system)}</div>
    </div>
  `).join('');

  document.getElementById('dataPopup').classList.add('is-open');
  normalizeSystemChipWidths();
}

async function boot(){

  const svg=await loadText('sachsenkarte.svg');
  document.getElementById('mapWrap').innerHTML=svg;

  const csv=await loadText('datenpopup.csv');
  const rows=parseCSV(csv);

  const byRegion={};
  rows.forEach(r=>{
    if(!byRegion[r.region_id])byRegion[r.region_id]=[];
    byRegion[r.region_id].push(r);
  });

  const regions=[...document.querySelectorAll('g.region[id]')];

  regions.forEach(g=>{
    g.addEventListener('click',()=>{
      const id=g.id;
      const data=byRegion[id]||[];
      renderDataPopup(data);
    });
  });

}

document.addEventListener('DOMContentLoaded',boot);
