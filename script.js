
/* Script ergänzt automatische Breitenanpassung der Pflegesystem-Chips pro Region */

function normalizeSystemChipWidths(){
  const stacks = Array.from(document.querySelectorAll('#dataPopupList .sys-stack'));
  let maxWidth = 0;
  const chips = [];

  stacks.forEach(stack => {
    const stackChips = Array.from(stack.querySelectorAll('.sys-chip'));
    stackChips.forEach(chip => {
      chip.style.width = 'auto';
      chips.push(chip);
      maxWidth = Math.max(maxWidth, chip.offsetWidth);
    });
  });

  chips.forEach(chip => {
    chip.style.width = maxWidth + 'px';
  });
}

/* Beobachtet Popup-Inhalt und passt Breiten automatisch an */
const observer = new MutationObserver(() => {
  normalizeSystemChipWidths();
});

document.addEventListener("DOMContentLoaded", () => {
  const popup = document.getElementById("dataPopupList");
  if(popup){
    observer.observe(popup,{childList:true,subtree:true});
  }
});
