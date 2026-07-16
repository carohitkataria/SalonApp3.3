// Gold-theme scoped stylesheet for the redesigned Settings page.
export const SETTINGS_V3_CSS = `
.setv3{--bg:#FBF8F1;--surface:#FFFFFF;
  --primary:#A67C1A;--primary-600:#8A6413;--primary-050:#FBF3E0;--primary-100:#F2E3C2;
  --ink:#2A2317;--ink-soft:#4A4033;--muted:#8B8069;--muted-2:#B0A48B;--line:#EFE9DC;--line-2:#F6F1E4;
  --amber:#E8952B;--amber-bg:#FDF3E4;--red:#E5484D;--red-bg:#FDECEC;--green:#2FA96A;--green-bg:#E7F6ED;
  --sky:#3E93E8;--sky-bg:#E9F2FD;
  --shadow:0 1px 2px rgba(42,35,23,.04),0 6px 20px rgba(42,35,23,.06);
  --radius:16px;--radius-sm:12px;
  font-family:'Inter',system-ui,sans-serif;color:var(--ink);line-height:1.45;background:var(--bg);
  padding:14px 4px 30px}
.setv3 h2,.setv3 h3,.setv3 h4{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:800;letter-spacing:-.2px;color:var(--ink)}
.setv3 button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.setv3 input,.setv3 select,.setv3 textarea{font-family:inherit}
.setv3 .phead{margin-bottom:14px}
.setv3 .phead h2{font-size:22px;font-weight:800;letter-spacing:-.5px;display:flex;align-items:center;gap:10px}
.setv3 .phead h2 .hic{width:34px;height:34px;border-radius:10px;background:var(--primary-050);color:var(--primary);display:grid;place-items:center}
.setv3 .phead h2 .hic svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2}
.setv3 .phead p{font-size:13px;color:var(--muted);margin-top:3px}
.setv3 .btn-primary{background:var(--primary);color:#fff;font-size:13px;font-weight:700;padding:11px 17px;border-radius:11px;display:inline-flex;align-items:center;gap:8px;border:none;cursor:pointer;transition:.15s}
.setv3 .btn-primary:hover{background:var(--primary-600)}
.setv3 .btn-primary svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}
.setv3 .btn-primary:disabled{opacity:.55;cursor:not-allowed}
.setv3 .btn-ghost{border:1px solid var(--line);color:var(--ink-soft);font-size:13px;font-weight:600;padding:9px 13px;border-radius:11px;display:inline-flex;align-items:center;gap:7px;background:var(--surface);cursor:pointer;transition:.15s}
.setv3 .btn-ghost:hover{background:var(--line-2)}
.setv3 .btn-ghost svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}
.setv3 .workspace{display:grid;grid-template-columns:268px 1fr;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;min-height:calc(100vh - 190px)}
.setv3 .pane-l{border-right:1px solid var(--line);background:#FEFCF7;display:flex;flex-direction:column;overflow:auto;max-height:calc(100vh - 190px)}
.setv3 .pane-r{min-width:0;display:flex;flex-direction:column;background:#fff}
.setv3 .nav-head{padding:13px 14px 9px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted-2);border-bottom:1px solid var(--line)}
.setv3 .setnav{padding:7px;display:flex;flex-direction:column;gap:2px}
.setv3 .sgroup{border-radius:11px;transition:.14s}
.setv3 .sgroup.on{background:var(--primary-050);border:1px solid var(--primary-100)}
.setv3 .sn{display:flex;align-items:center;gap:10px;padding:10px 11px;border-radius:11px;font-size:13.5px;font-weight:600;color:var(--ink-soft);width:100%;text-align:left;transition:.14s;background:none;border:none;cursor:pointer}
.setv3 .sn svg.ic{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;flex:none;color:var(--muted)}
.setv3 .sgroup:not(.on) .sn:hover{background:var(--line-2)}
.setv3 .sgroup.on .sn{color:var(--primary);font-weight:700}
.setv3 .sgroup.on .sn svg.ic{color:var(--primary)}
.setv3 .sn .chev{width:14px;height:14px;margin-left:auto;color:var(--muted-2);fill:none;stroke:currentColor;stroke-width:2.4;transition:.2s;flex:none}
.setv3 .sgroup.on .sn .chev{transform:rotate(90deg);color:var(--primary)}
.setv3 .subnav{display:none;padding:1px 8px 8px 12px;flex-direction:column;gap:2px}
.setv3 .sgroup.on .subnav{display:flex}
.setv3 .subitem{display:flex;align-items:center;gap:9px;padding:7px 11px 7px 22px;border-radius:9px;font-size:12.5px;font-weight:600;color:var(--ink-soft);text-align:left;width:100%;transition:.13s;background:none;border:none;cursor:pointer;position:relative}
.setv3 .subitem::before{content:"";position:absolute;left:12px;top:50%;width:4px;height:4px;border-radius:50%;background:var(--muted-2);transform:translateY(-50%)}
.setv3 .subitem:hover{background:#fff}
.setv3 .subitem.on{background:var(--primary);color:#fff}
.setv3 .subitem.on::before{background:#fff}
.setv3 .pane-body{flex:1;overflow:auto;padding:22px 26px}
.setv3 .bhead{margin-bottom:16px}
.setv3 .bhead h3{font-size:18px;font-weight:800;color:var(--ink)}
.setv3 .bhead p{font-size:12.5px;color:var(--muted);margin-top:3px}
.setv3 .block{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:14px}
.setv3 .block h4{font-size:13px;font-weight:800;color:var(--ink);margin-bottom:3px}
.setv3 .block p.bs{font-size:11.5px;color:var(--muted);margin-bottom:12px}
.setv3 .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px 18px}
.setv3 .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px 15px}
.setv3 .field{display:flex;flex-direction:column;gap:6px}
.setv3 .field.full{grid-column:1/-1}
.setv3 .field label{font-size:12.5px;font-weight:600;color:var(--ink-soft)}
.setv3 .field label .req{color:var(--red)}
.setv3 .field input,.setv3 .field select,.setv3 .field textarea{font-size:13.5px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;outline:none;width:100%;color:var(--ink);background:var(--surface);transition:.15s;font-family:inherit}
.setv3 .field textarea{min-height:64px;resize:vertical}
.setv3 .field input:focus,.setv3 .field select:focus,.setv3 .field textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-050)}
.setv3 .field .hint{font-size:11px;color:var(--muted)}
.setv3 .toggle{width:42px;height:24px;border-radius:20px;background:var(--line);position:relative;transition:.2s;flex:none;cursor:pointer;border:none}
.setv3 .toggle::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.setv3 .toggle.on{background:var(--primary)}
.setv3 .toggle.on::after{left:21px}
.setv3 .opt-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--line-2);gap:14px}
.setv3 .opt-row:last-child{border-bottom:none}
.setv3 .opt-row .on-l b{font-size:13px;font-weight:600;color:var(--ink);display:block}
.setv3 .opt-row .on-l span{font-size:11.5px;color:var(--muted)}
.setv3 .list-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line-2)}
.setv3 .list-row:last-child{border-bottom:none}
.setv3 .list-row .li{width:34px;height:34px;border-radius:9px;background:var(--line-2);color:var(--muted);display:grid;place-items:center;flex:none}
.setv3 .list-row .li svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}
.setv3 .list-row .ld{flex:1;min-width:0}
.setv3 .list-row .ld b{font-size:13px;font-weight:700;color:var(--ink);display:block}
.setv3 .list-row .ld span{font-size:11.5px;color:var(--muted)}
.setv3 .tag{font-size:11px;font-weight:700;padding:4px 9px;border-radius:20px;background:var(--primary-050);color:var(--primary)}
.setv3 .status-pill{font-size:11px;font-weight:700;padding:4px 9px;border-radius:20px}
.setv3 .status-pill.ok{background:var(--green-bg);color:var(--green)}
.setv3 .note-box{display:flex;align-items:flex-start;gap:9px;background:var(--sky-bg);border:1px solid #CFE4FA;border-radius:11px;padding:11px 13px;font-size:12px;color:var(--ink-soft)}
.setv3 .note-box svg{width:15px;height:15px;color:var(--sky);fill:none;stroke:currentColor;stroke-width:2;flex:none;margin-top:2px}
.setv3 .save-row{display:flex;justify-content:flex-end;margin-top:6px}
.setv3 .method-pick{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}
.setv3 .method{border:1.5px solid var(--line);border-radius:12px;padding:14px;text-align:left;transition:.15s;position:relative;cursor:pointer;background:#fff}
.setv3 .method:hover{border-color:var(--primary-100)}
.setv3 .method.on{border-color:var(--primary);background:var(--primary-050)}
.setv3 .method .rd{width:18px;height:18px;border-radius:50%;border:2px solid var(--muted-2);position:absolute;top:14px;right:14px;transition:.15s}
.setv3 .method.on .rd{border-color:var(--primary);background:var(--primary);box-shadow:inset 0 0 0 3px #fff}
.setv3 .method .mtop{display:flex;align-items:center;gap:9px;margin-bottom:6px}
.setv3 .method .mi{width:34px;height:34px;border-radius:10px;background:var(--primary-050);color:var(--primary);display:grid;place-items:center}
.setv3 .method .mi svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2}
.setv3 .method b{font-size:13.5px;font-weight:800;color:var(--ink)}
.setv3 .method p{font-size:11.5px;color:var(--muted);margin-top:4px}
.setv3 .hour-row{display:grid;grid-template-columns:70px auto 1fr;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line-2)}
.setv3 .hour-row:last-child{border-bottom:none}
.setv3 .hour-row .dow{font-size:13px;font-weight:700;color:var(--ink)}
.setv3 .hour-row .times{display:flex;align-items:center;gap:8px}
.setv3 .hour-row .times input{border:1px solid var(--line);border-radius:9px;padding:6px 9px;font-size:12.5px;background:#fff;color:var(--ink)}
.setv3 .hour-row .times .to{font-size:11.5px;color:var(--muted)}
.setv3 .hour-row .times .closed{font-size:12px;color:var(--muted);font-style:italic}
.setv3 .rbac-lock{padding:32px;text-align:center;color:var(--muted);font-size:14px}
.setv3 .rbac-lock svg{width:44px;height:44px;color:var(--muted-2);margin:0 auto 10px;fill:none;stroke:currentColor;stroke-width:2}
@media(max-width:1050px){
  .setv3 .workspace{grid-template-columns:1fr}
  .setv3 .pane-l{border-right:none;border-bottom:1px solid var(--line);max-height:none}
  .setv3 .grid2,.setv3 .grid3,.setv3 .method-pick{grid-template-columns:1fr}
}
`;
