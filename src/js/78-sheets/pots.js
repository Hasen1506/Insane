SHEETS["pay-note"]=(sh,close)=>{
  return `<h2>How to pay you</h2><label class="f" for="pay">A payment link or sort code people can use</label><input class="in-t" id="pay" data-f="pay" value="${esc(F.pay||'')}" maxlength="80" placeholder="monzo.me/maya"><div class="btns"><button class="btn" data-act="pay-save" data-v="${esc(sh.id)}">Save</button><button class="btn ghost" data-act="sheet-close">Cancel</button></div>`;
};
