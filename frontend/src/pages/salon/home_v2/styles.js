// Zenoti-style CSS lifted from salon_home V.1.html mock.
// Scoped under `.shv2` so it never leaks into the rest of the app.
export const HOME_V2_CSS = `
.shv2, .shv2 * { box-sizing: border-box; margin: 0; padding: 0; }
.shv2 {
  --bg:#F6F6FB;--surface:#FFFFFF;--primary:#6C4FE0;--primary-600:#5B3FD1;
  --primary-050:#F1EEFF;--primary-100:#E7E2FF;--ink:#23252F;--ink-soft:#3C3F4E;
  --muted:#7C8092;--muted-2:#9A9EAE;--line:#ECECF3;--line-2:#F3F3F8;
  --amber:#E8952B;--amber-bg:#FDF3E4;--teal:#12A594;--teal-bg:#E4F6F3;
  --rose:#E45C86;--rose-bg:#FCEAF1;--sky:#3E93E8;--sky-bg:#E9F2FD;
  --green:#2FA96A;--green-bg:#E7F6ED;--violet:#6C4FE0;--violet-bg:#EFEBFE;
  --wa:#25D366;--wa-bg:#E7F9EF;
  --shadow:0 1px 2px rgba(30,32,50,.04),0 6px 20px rgba(30,32,50,.05);
  --shadow-lg:0 10px 40px rgba(30,32,50,.14);
  --radius:16px;--radius-sm:12px;--rail:84px;--ribbon:58px;
  font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.45;
  min-height:100vh;font-weight:500;
}
.shv2 h1,.shv2 h2,.shv2 h3,.shv2 h4{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:800;letter-spacing:-.2px}
.shv2-drawer h1,.shv2-drawer h2,.shv2-drawer h3,.shv2-drawer h4{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:800}
.shv2 button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
.shv2 svg{display:block}
.shv2 input,.shv2 select,.shv2 textarea{font-family:inherit}
.shv2 ::-webkit-scrollbar{width:9px;height:9px}
.shv2 ::-webkit-scrollbar-thumb{background:#D9D9E4;border-radius:20px}
.shv2 ::-webkit-scrollbar-track{background:transparent}

/* RAIL */
.shv2 .rail{position:fixed;left:0;top:0;bottom:0;width:var(--rail);background:var(--surface);border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;padding:16px 0 14px;z-index:40}
.shv2 .rail__logo{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,var(--primary),#8A73F0);display:grid;place-items:center;color:#fff;box-shadow:0 6px 16px rgba(108,79,224,.35);margin-bottom:22px;flex:none}
.shv2 .rail__nav{display:flex;flex-direction:column;gap:4px;width:100%;align-items:center;flex:1;overflow-y:auto;max-height:calc(100vh - 200px);padding-bottom:12px}
.shv2 .navitem{width:60px;height:56px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;color:var(--muted-2);position:relative;transition:.18s;flex:none}
.shv2 .navitem span{font-size:10px;font-weight:600}
.shv2 .navitem svg{width:21px;height:21px;stroke-width:1.9;fill:none;stroke:currentColor}
.shv2 .navitem:hover{background:var(--line-2);color:var(--ink-soft)}
.shv2 .navitem.active{background:var(--primary-050);color:var(--primary)}
.shv2 .navitem.active::before{content:"";position:absolute;left:-12px;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:var(--primary)}
.shv2 .rail__foot{display:flex;flex-direction:column;gap:10px;align-items:center;padding-top:8px;border-top:1px solid var(--line);width:52px}
.shv2 .rail__avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#F5A623,#E8952B);display:grid;place-items:center;color:#fff;font-weight:700;font-size:14px}

/* RIBBON */
.shv2 .ribbon{position:fixed;right:0;top:0;bottom:0;width:var(--ribbon);background:var(--surface);border-left:1px solid var(--line);display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 0;z-index:40}
.shv2 .ribbon__btn{width:42px;height:42px;border-radius:12px;color:var(--muted);display:grid;place-items:center;position:relative;transition:.16s;flex:none}
.shv2 .ribbon__btn svg{width:20px;height:20px;stroke-width:1.9;fill:none;stroke:currentColor}
.shv2 .ribbon__btn:hover{background:var(--primary-050);color:var(--primary)}
.shv2 .ribbon__btn .dot{position:absolute;top:8px;right:9px;min-width:15px;height:15px;padding:0 4px;border-radius:20px;background:var(--rose);color:#fff;font-size:9px;font-weight:800;display:grid;place-items:center;border:2px solid #fff}
.shv2 .ribbon__sep{width:26px;height:1px;background:var(--line);margin:4px 0}
.shv2 .ribbon__btn[data-tip]::after{content:attr(data-tip);position:absolute;right:52px;top:50%;transform:translateY(-50%) scale(.96);background:var(--ink);color:#fff;font-size:11.5px;font-weight:500;white-space:nowrap;padding:6px 10px;border-radius:8px;opacity:0;pointer-events:none;transition:.15s;z-index:5}
.shv2 .ribbon__btn[data-tip]:hover::after{opacity:1;transform:translateY(-50%) scale(1)}
.shv2 .ribbon__cta{background:var(--primary);color:#fff}
.shv2 .ribbon__cta:hover{background:var(--primary-600);color:#fff}

/* SHELL */
.shv2 .main{margin-left:var(--rail);margin-right:var(--ribbon);min-height:100vh}
.shv2 .topbar{position:sticky;top:0;z-index:30;background:rgba(246,246,251,.85);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:14px 30px;display:flex;align-items:center;gap:18px}
.shv2 .brand{display:flex;align-items:center;gap:12px}
.shv2 .brand__ic{width:40px;height:40px;border-radius:12px;background:var(--primary-050);color:var(--primary);display:grid;place-items:center}
.shv2 .brand__ic svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2}
.shv2 .brand h1{font-size:16px;font-weight:800;letter-spacing:-.2px}
.shv2 .brand p{font-size:12px;color:var(--muted)}
.shv2 .topbar__spacer{flex:1}
.shv2 .searchbox{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:9px 14px;width:260px;color:var(--muted)}
.shv2 .searchbox input{border:none;outline:none;background:none;font-size:13.5px;color:var(--ink);width:100%}
.shv2 .searchbox svg{width:17px;height:17px;flex:none;fill:none;stroke:currentColor;stroke-width:2}
.shv2 .branch{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:9px 12px;font-size:13px;font-weight:600}
.shv2 .branch svg{width:16px;height:16px;color:var(--muted);fill:none;stroke:currentColor;stroke-width:2}
.shv2 .content{padding:24px 30px 60px;max-width:1360px}

/* GREETING + FILTER */
.shv2 .greet{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:22px}
.shv2 .greet h2{font-size:25px;font-weight:800;letter-spacing:-.5px}
.shv2 .greet h2 b{color:var(--primary)}
.shv2 .greet .date{font-size:13px;color:var(--muted);margin-top:3px}
.shv2 .greet__right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.shv2 .seg{display:flex;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:3px}
.shv2 .seg button{padding:7px 15px;border-radius:8px;font-size:13px;font-weight:600;color:var(--muted);transition:.15s}
.shv2 .seg button.on{background:var(--primary);color:#fff}
.shv2 .live{display:flex;align-items:center;gap:7px;background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;padding:8px 13px;border-radius:11px}
.shv2 .live .pulse{width:8px;height:8px;border-radius:50%;background:var(--green);animation:shv2pulse 1.8s infinite}
@keyframes shv2pulse{0%{box-shadow:0 0 0 0 rgba(47,169,106,.5)}70%{box-shadow:0 0 0 8px rgba(47,169,106,0)}100%{box-shadow:0 0 0 0 rgba(47,169,106,0)}}
.shv2 .range-picker{display:flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:6px 10px;font-size:12.5px}
.shv2 .range-picker input{border:none;outline:none;font-size:12.5px;color:var(--ink);background:none;width:120px}

/* KPI GRID */
.shv2 .kgrid{display:grid;grid-template-columns:repeat(5,1fr);grid-auto-rows:minmax(118px,auto);gap:16px;margin-bottom:16px}
.shv2 .kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 17px;box-shadow:var(--shadow);display:flex;flex-direction:column;transition:.18s}
.shv2 .kpi.click{cursor:pointer}
.shv2 .kpi.click:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.shv2 .kpi__top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.shv2 .chip{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex:none}
.shv2 .chip svg{width:18px;height:18px;stroke-width:2;fill:none;stroke:currentColor}
.shv2 .chip.amber{background:var(--amber-bg);color:var(--amber)}
.shv2 .chip.teal{background:var(--teal-bg);color:var(--teal)}
.shv2 .chip.rose{background:var(--rose-bg);color:var(--rose)}
.shv2 .chip.sky{background:var(--sky-bg);color:var(--sky)}
.shv2 .chip.violet{background:var(--violet-bg);color:var(--violet)}
.shv2 .chip.green{background:var(--green-bg);color:var(--green)}
.shv2 .trend{font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;display:flex;align-items:center;gap:3px}
.shv2 .trend svg{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:3}
.shv2 .trend.up{background:var(--green-bg);color:var(--green)}
.shv2 .trend.down{background:var(--rose-bg);color:var(--rose)}
.shv2 .trend.flat{background:var(--line-2);color:var(--muted)}
.shv2 .kpi__val{font-family:'Plus Jakarta Sans';font-size:24px;font-weight:800;letter-spacing:-.6px}
.shv2 .kpi__lbl{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.4px;text-transform:uppercase;margin-top:3px}

/* Customer-count mini bar */
.shv2 .cbars{display:flex;align-items:flex-end;gap:8px;height:44px;margin:6px 0 4px}
.shv2 .cbar{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end}
.shv2 .cbar .b{width:100%;max-width:20px;border-radius:5px 5px 3px 3px;min-height:4px;transition:.3s}
.shv2 .cbar .c{font-size:10px;font-weight:700;color:var(--ink-soft)}
.shv2 .cleg{display:flex;flex-wrap:wrap;gap:3px 10px;font-size:9.5px;color:var(--muted);font-weight:600;margin-top:2px}
.shv2 .cleg span{display:flex;align-items:center;gap:4px}
.shv2 .cleg i{width:7px;height:7px;border-radius:2px}

/* Staff check-in chip */
.shv2 .schead{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.shv2 .schead .lab{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans'}
.shv2 .schead .lab svg{width:16px;height:16px;color:var(--primary);fill:none;stroke:currentColor;stroke-width:2}
.shv2 .schead .sum{font-size:11px;font-weight:600;color:var(--muted)}
.shv2 .sc-row{display:flex;align-items:center;gap:9px;padding:6px 0}
.shv2 .sc-row .av{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;font-size:11px;flex:none}
.shv2 .sc-row .nm{flex:1;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shv2 .sc-row .st{font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:20px;text-transform:uppercase;letter-spacing:.2px}
.shv2 .st.in{background:var(--green-bg);color:var(--green)} .shv2 .st.late{background:var(--amber-bg);color:var(--amber)} .shv2 .st.out{background:var(--line-2);color:var(--muted)}
.shv2 .sc-btn{font-size:10.5px;font-weight:700;padding:5px 9px;border-radius:8px;border:1px solid var(--line);color:var(--ink-soft);transition:.15s;flex:none}
.shv2 .sc-btn:hover{border-color:var(--primary);color:var(--primary)}
.shv2 .sc-btn.out{background:var(--primary-050);color:var(--primary);border-color:var(--primary-100)}

/* Upcoming Queue block — 2x2 in kpi grid */
.shv2 .queue{grid-column:span 2;grid-row:span 2;padding:18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);display:flex;flex-direction:column;min-height:250px}
.shv2 .queue__h{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:8px;flex-wrap:wrap}
.shv2 .queue__h .t{display:flex;align-items:center;gap:9px;font-size:14.5px;font-weight:700;font-family:'Plus Jakarta Sans'}
.shv2 .queue__h .t svg{width:17px;height:17px;color:var(--primary);fill:none;stroke:currentColor;stroke-width:2}
.shv2 .queue__ctrls{display:flex;align-items:center;gap:8px}
.shv2 .queue__ctrls select{font-size:12px;font-weight:600;color:var(--ink-soft);border:1px solid var(--line);border-radius:8px;padding:5px 9px;outline:none;background:var(--surface)}
.shv2 .queue__ctrls a{font-size:12px;color:var(--primary);font-weight:700;display:flex;align-items:center;gap:2px;cursor:pointer}
.shv2 .qlist{display:flex;flex-direction:column;gap:8px;overflow:auto;flex:1}
.shv2 .q-row{display:flex;align-items:center;gap:11px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;transition:.15s}
.shv2 .q-row:hover{border-color:var(--primary-100);background:var(--primary-050)}
.shv2 .q-pos{width:24px;height:24px;border-radius:8px;background:var(--primary-050);color:var(--primary);font-weight:800;font-size:12px;display:grid;place-items:center;flex:none}
.shv2 .q-info{flex:1;min-width:0}
.shv2 .q-info b{font-size:13px;font-weight:700;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shv2 .q-info span{font-size:11.5px;color:var(--muted)}
.shv2 .q-wait{font-size:10.5px;font-weight:700;color:var(--amber);background:var(--amber-bg);padding:3px 8px;border-radius:20px;flex:none}
.shv2 .q-acts{display:flex;gap:4px;flex:none}
.shv2 .q-actbtn{width:28px;height:28px;border-radius:8px;background:var(--line-2);color:var(--ink-soft);display:grid;place-items:center;transition:.15s;border:1px solid transparent}
.shv2 .q-actbtn:hover{background:var(--primary-050);color:var(--primary);border-color:var(--primary-100)}
.shv2 .q-actbtn.call:hover{background:var(--green-bg);color:var(--green)}
.shv2 .q-actbtn.done:hover{background:var(--green-bg);color:var(--green)}
.shv2 .q-actbtn.skip:hover{background:var(--rose-bg);color:var(--rose)}
.shv2 .q-actbtn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.2}
.shv2 .q-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--muted)}
.shv2 .q-empty .ring{width:46px;height:46px;border-radius:50%;border:2px solid var(--teal);display:grid;place-items:center;color:var(--teal)}
.shv2 .q-empty .ring svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.5}

/* SECONDARY STRIP */
.shv2 .strip{display:grid;grid-template-columns:0.8fr 0.8fr 0.8fr 1.9fr;gap:14px;margin-bottom:26px}
.shv2 .mini{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px 15px;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow)}
.shv2 .mini .chip{width:34px;height:34px;border-radius:10px}
.shv2 .mini b{font-family:'Plus Jakarta Sans';font-size:17px;font-weight:800;display:block;line-height:1.1;letter-spacing:-.3px}
.shv2 .mini span{font-size:10.5px;color:var(--muted);font-weight:700;letter-spacing:.3px;text-transform:uppercase}
/* wide whatsapp send-link */
.shv2 .wacard{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:9px;position:relative}
.shv2 .wacard .wah{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;justify-content:space-between}
.shv2 .wacard .wah .l{display:flex;align-items:center;gap:8px}
.shv2 .wacard .wah .wic{width:26px;height:26px;border-radius:8px;background:var(--wa-bg);color:var(--wa);display:grid;place-items:center}
.shv2 .wacard .wah .wic svg{width:15px;height:15px;fill:currentColor;stroke:none}
.shv2 .wacard .link-seg{display:flex;background:var(--line-2);border-radius:8px;padding:2px;gap:2px}
.shv2 .wacard .link-seg button{font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:6px;color:var(--muted);letter-spacing:.2px}
.shv2 .wacard .link-seg button.on{background:var(--wa);color:#fff}
.shv2 .wa-input{display:flex;gap:7px;align-items:stretch}
.shv2 .phone-wrap{flex:1;min-width:0;position:relative;display:flex}
.shv2 .phone-wrap input{flex:1;min-width:0;border:1px solid var(--line);border-radius:9px;padding:8px 40px 8px 12px;font-size:13px;font-weight:600;outline:none;color:var(--ink)}
.shv2 .phone-wrap input:focus{border-color:var(--wa);box-shadow:0 0 0 3px var(--wa-bg)}
.shv2 .phone-wrap .cust-drop{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:26px;height:26px;border-radius:7px;display:grid;place-items:center;color:var(--muted);background:transparent;transition:.15s}
.shv2 .phone-wrap .cust-drop:hover{background:var(--primary-050);color:var(--primary)}
.shv2 .phone-wrap .cust-drop svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.4}
.shv2 .cust-menu{position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-lg);z-index:8;max-height:340px;overflow:auto;padding:6px}
.shv2 .cust-menu .cs{padding:6px 10px 8px;border-bottom:1px solid var(--line);margin-bottom:4px}
.shv2 .cust-menu .cs input{width:100%;border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:12.5px;outline:none}
.shv2 .cust-menu .cs input:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-050)}
.shv2 .cust-menu .cust-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:.12s}
.shv2 .cust-menu .cust-row:hover{background:var(--primary-050)}
.shv2 .cust-menu .cust-row .av{width:34px;height:34px;border-radius:50%;background:#F1EEFF;color:var(--primary);display:grid;place-items:center;font-weight:800;font-size:13px;flex:none;background-size:cover;background-position:center}
.shv2 .cust-menu .cust-row .info{flex:1;min-width:0}
.shv2 .cust-menu .cust-row .info b{font-size:13px;font-weight:700;color:var(--ink);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shv2 .cust-menu .cust-row .info span{font-size:11px;color:var(--muted);font-weight:600}
.shv2 .cust-menu .cust-row .lv{font-size:10.5px;color:var(--muted-2);font-weight:700;text-align:right;flex:none;line-height:1.2}
.shv2 .cust-menu .cust-row .lv small{font-size:9.5px;font-weight:600;color:var(--muted);display:block;text-transform:uppercase;letter-spacing:.3px}
.shv2 .cust-menu .empty{font-size:12px;color:var(--muted);padding:16px;text-align:center;font-weight:600}
.shv2 .wa-send{background:var(--wa);color:#fff;border-radius:9px;padding:0 14px;display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;flex:none}
.shv2 .wa-send svg{width:14px;height:14px;fill:currentColor;stroke:none}
.shv2 .wa-copy{background:var(--line-2);color:var(--ink-soft);border-radius:9px;padding:0 10px;display:grid;place-items:center;transition:.2s cubic-bezier(.22,.61,.36,1);flex:none;border:1px solid var(--line)}
.shv2 .wa-copy:hover{background:var(--primary-050);color:var(--primary);border-color:var(--primary-100)}
.shv2 .wa-copy svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2}
.shv2 .wa-copy.copied{background:#E7F6ED;color:#2FA96A;border-color:#B9E5C8;animation:shv2-copyPop .34s ease-out}
@keyframes shv2-copyPop{0%{transform:scale(.85)}55%{transform:scale(1.15)}100%{transform:scale(1)}}
.shv2 .copy-flash{font-size:11px;font-weight:800;margin-top:2px;letter-spacing:.2px;animation:shv2-flashIn .28s ease-out}
.shv2 .copy-flash.ok{color:#2FA96A}
.shv2 .copy-flash.err{color:#E45C86}
@keyframes shv2-flashIn{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:translateY(0)}}

/* SECTIONS */
.shv2 .row{display:grid;gap:18px;margin-bottom:18px}
.shv2 .row.a{grid-template-columns:1.6fr 1fr}
.shv2 .row.b{grid-template-columns:1fr 1fr 1fr}
.shv2 .row.c{grid-template-columns:1fr 1fr 1fr}
.shv2 .card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px}
.shv2 .card__h{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:8px}
.shv2 .card__h .t{display:flex;align-items:center;gap:9px;font-size:14.5px;font-weight:700;font-family:'Plus Jakarta Sans'}
.shv2 .card__h .t svg{width:17px;height:17px;color:var(--primary);fill:none;stroke:currentColor;stroke-width:2}
.shv2 .card__h a{font-size:12.5px;color:var(--primary);font-weight:600;cursor:pointer}
.shv2 .card__h select{font-size:12px;font-weight:600;color:var(--ink-soft);border:1px solid var(--line);border-radius:8px;padding:5px 9px;outline:none;background:var(--surface)}

/* Marketing */
.shv2 .mk-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.shv2 .mk-stat{border:1px solid var(--line);border-radius:12px;padding:13px 14px}
.shv2 .mk-stat b{font-family:'Plus Jakarta Sans';font-size:19px;font-weight:800;display:block}
.shv2 .mk-stat span{font-size:10.5px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.shv2 .mk-stat small{font-size:10.5px;font-weight:700}
.shv2 .mk-camp{display:flex;flex-direction:column;gap:8px}
.shv2 .mk-c{display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid var(--line);border-radius:11px}
.shv2 .mk-c .ci{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex:none}
.shv2 .mk-c .ci svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}
.shv2 .mk-c .cn{flex:1;min-width:0}
.shv2 .mk-c .cn b{font-size:13px;font-weight:700;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shv2 .mk-c .cn span{font-size:11px;color:var(--muted)}
.shv2 .mk-c .cv{text-align:right;flex:none}
.shv2 .mk-c .cv b{font-family:'Plus Jakarta Sans';font-size:14px;font-weight:800;color:var(--green)}
.shv2 .mk-c .cv span{font-size:10.5px;color:var(--muted)}
.shv2 .mk-chan{margin-top:16px}
.shv2 .mk-chan .cl{display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);font-weight:600;margin-bottom:8px}
.shv2 .mk-chan-bar{height:9px;border-radius:20px;overflow:hidden;display:flex}
.shv2 .mk-chan-bar i{height:100%}

/* small shared bits */
.shv2 .lb__row{display:flex;align-items:center;gap:11px;padding:8px 4px}
.shv2 .rank{width:24px;height:24px;border-radius:7px;background:var(--amber-bg);color:var(--amber);font-weight:800;font-size:12px;display:grid;place-items:center;flex:none}
.shv2 .lb__row .nm{flex:1;font-size:13.5px;font-weight:600}
.shv2 .lb__row .amt{font-family:'Plus Jakarta Sans';font-weight:800;font-size:14px}
.shv2 .tgt__row{margin-bottom:15px}
.shv2 .tgt__row .tl{display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:7px}
.shv2 .tgt__row .tl span{color:var(--muted-2);font-weight:600}
.shv2 .tgt__row .tl b{font-weight:700;color:var(--ink-soft)}
.shv2 .bar{height:8px;background:var(--line-2);border-radius:20px;overflow:hidden}
.shv2 .bar i{display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,var(--primary),#8A73F0)}
.shv2 .pay__row{display:flex;align-items:center;gap:10px;padding:6px 0}
.shv2 .pay__dot{width:9px;height:9px;border-radius:50%;flex:none}
.shv2 .pay__row .pl{flex:1;font-size:13px;font-weight:600;text-transform:capitalize}
.shv2 .pay__row .pv{font-family:'Plus Jakarta Sans';font-weight:800;font-size:14px}
.shv2 .rev{display:flex;gap:16px;align-items:center}
.shv2 .rev__score{text-align:center;flex:none}
.shv2 .rev__score b{font-family:'Plus Jakarta Sans';font-size:38px;font-weight:800;color:var(--amber);line-height:1}
.shv2 .rev__score .stars{color:var(--amber);font-size:13px;margin:3px 0}
.shv2 .rev__score small{font-size:11px;color:var(--muted)}
.shv2 .rev__bars{flex:1;display:flex;flex-direction:column;gap:5px}
.shv2 .rev__bar{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted)}
.shv2 .rev__bar .lab{width:24px;font-weight:600}
.shv2 .rev__bar .bar{flex:1}
.shv2 .rev__bar .n{width:20px;text-align:right;font-weight:600}
.shv2 .stat-big{font-family:'Plus Jakarta Sans';font-weight:800;font-size:22px}
.shv2 .spark{margin-top:12px;height:60px;width:100%}
.shv2 .foot-note{font-size:11.5px;color:var(--muted-2);margin-top:12px}
.shv2 .topsvc__row{display:flex;align-items:center;gap:11px;padding:5px 0}
.shv2 .topsvc__row .n{width:22px;height:22px;border-radius:7px;background:var(--primary-050);color:var(--primary);font-weight:800;font-size:11px;display:grid;place-items:center;flex:none}
.shv2 .topsvc__row .nm{flex:1;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shv2 .topsvc__row .ct{font-size:12px;font-weight:700;color:var(--primary);background:var(--primary-050);padding:3px 9px;border-radius:20px}

/* ===== DRAWERS ===== */
.shv2-overlay{position:fixed;inset:0;background:rgba(28,26,54,.42);backdrop-filter:blur(2px);opacity:0;visibility:hidden;transition:.28s;z-index:60}
.shv2-overlay.open{opacity:1;visibility:visible}
.shv2-drawer{position:fixed;top:0;right:0;bottom:0;width:min(1100px,75vw);background:#FFFFFF;z-index:70;transform:translateX(100%);transition:transform .32s cubic-bezier(.22,.61,.36,1);display:flex;flex-direction:column;font-family:'Inter',system-ui,sans-serif;color:#23252F}
.shv2-drawer.open{transform:translateX(0);box-shadow:-20px 0 60px rgba(28,26,54,.22)}
.shv2-drawer.narrow{width:min(720px,60vw)}
.shv2-drawer.stacked{z-index:80;width:min(720px,55vw)}
.shv2-drawer h1,.shv2-drawer h2,.shv2-drawer h3,.shv2-drawer h4{font-family:'Plus Jakarta Sans','Inter',sans-serif}
.shv2-drawer *{box-sizing:border-box}
.shv2-drawer .drawer__h{display:flex;align-items:center;justify-content:space-between;padding:20px 26px;border-bottom:1px solid #ECECF3}
.shv2-drawer .drawer__h .tt{display:flex;align-items:center;gap:12px}
.shv2-drawer .drawer__h .tt .ic{width:40px;height:40px;border-radius:12px;background:#F1EEFF;color:#6C4FE0;display:grid;place-items:center}
.shv2-drawer .drawer__h .tt .ic svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2}
.shv2-drawer .drawer__h h3{font-size:18px;font-weight:800}
.shv2-drawer .drawer__h p{font-size:12.5px;color:#7C8092;margin-top:2px}
.shv2-drawer .drawer__close{width:38px;height:38px;border-radius:11px;background:#F3F3F8;color:#7C8092;display:grid;place-items:center;transition:.15s;cursor:pointer;border:none}
.shv2-drawer .drawer__close:hover{background:#FCEAF1;color:#E45C86}
.shv2-drawer .drawer__close svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2.2}
.shv2-drawer .drawer__body{flex:1;overflow:auto;padding:22px 26px}
.shv2-drawer .drawer__f{padding:14px 26px;border-top:1px solid #ECECF3;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#FFFFFF;flex-wrap:wrap}
.shv2-drawer .drawer__f .hint{font-size:12px;color:#7C8092}
.shv2-drawer .drawer__f .acts{display:flex;gap:10px}
.shv2-drawer .btn-primary{background:#6C4FE0;color:#fff;font-size:13px;font-weight:700;padding:11px 18px;border-radius:11px;display:inline-flex;align-items:center;gap:8px;transition:.15s;border:none;cursor:pointer}
.shv2-drawer .btn-primary:hover{background:#5B3FD1}
.shv2-drawer .btn-primary:disabled{opacity:.5;cursor:not-allowed}
.shv2-drawer .btn-primary svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}
.shv2-drawer .btn-ghost{border:1px solid #ECECF3;color:#3C3F4E;font-size:13px;font-weight:600;padding:11px 18px;border-radius:11px;transition:.15s;background:#FFFFFF;cursor:pointer}
.shv2-drawer .btn-ghost:hover{background:#F3F3F8}
.shv2-drawer .fs-title{font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#9A9EAE;margin:4px 0 14px}
.shv2-drawer .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px 18px}
.shv2-drawer .field{display:flex;flex-direction:column;gap:7px;margin-bottom:16px;position:relative}
.shv2-drawer .field.full{grid-column:1 / -1}
.shv2-drawer .field label{font-size:12.5px;font-weight:600;color:#3C3F4E;display:flex;align-items:center;justify-content:space-between}
.shv2-drawer .field label .req{color:#E45C86}
.shv2-drawer .field input,.shv2-drawer .field select,.shv2-drawer .field textarea{font-size:13.5px;color:#23252F;border:1px solid #ECECF3;border-radius:10px;padding:11px 13px;outline:none;background:#FFFFFF;transition:.15s;width:100%;font-family:inherit}
.shv2-drawer .field textarea{resize:vertical;min-height:70px}
.shv2-drawer .field input:focus,.shv2-drawer .field select:focus,.shv2-drawer .field textarea:focus{border-color:#6C4FE0;box-shadow:0 0 0 3px #F1EEFF}
.shv2-drawer .field input.err,.shv2-drawer .field select.err{border-color:#E45C86;box-shadow:0 0 0 3px #FCEAF1}
.shv2-drawer .field .msg{font-size:11.5px;color:#E45C86;font-weight:600;display:none;margin-top:2px}
.shv2-drawer .field .msg.show{display:block}
.shv2-drawer .phone{display:flex;gap:8px}.shv2-drawer .phone select{width:96px;flex:none}
.shv2-drawer .seg-pick{display:flex;gap:8px}
.shv2-drawer .seg-pick button{flex:1;border:1px solid #ECECF3;border-radius:10px;padding:10px;font-size:13px;font-weight:600;color:#7C8092;transition:.15s;background:#FFFFFF;cursor:pointer}
.shv2-drawer .seg-pick button.on{border-color:#6C4FE0;background:#F1EEFF;color:#6C4FE0}
.shv2-drawer .tags{display:flex;flex-wrap:wrap;gap:8px}
.shv2-drawer .tag{font-size:12px;font-weight:600;color:#7C8092;border:1px solid #ECECF3;padding:7px 12px;border-radius:20px;transition:.15s;background:#FFFFFF;cursor:pointer}
.shv2-drawer .tag.on{border-color:#6C4FE0;background:#F1EEFF;color:#6C4FE0}
.shv2-drawer .photo-row{display:flex;align-items:center;gap:16px;margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid #F3F3F8}
.shv2-drawer .photo{width:64px;height:64px;border-radius:50%;background:#F1EEFF;color:#6C4FE0;display:grid;place-items:center;flex:none;border:2px dashed #E7E2FF}
.shv2-drawer .photo svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8}
.shv2-drawer .photo-row .pt b{font-size:14px;font-weight:700;display:block}
.shv2-drawer .photo-row .pt span{font-size:12px;color:#7C8092}
.shv2-drawer .photo-row button{margin-top:8px;font-size:12.5px;font-weight:600;color:#6C4FE0;border:1px solid #E7E2FF;padding:7px 13px;border-radius:9px;background:#F1EEFF;cursor:pointer}
/* appointment mode toggle — small chips */
.shv2-drawer .mode-pick{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:18px}
.shv2-drawer .mode{border:1px solid #ECECF3;border-radius:10px;padding:8px 10px;text-align:left;transition:.15s;display:flex;align-items:center;gap:8px;background:#FFFFFF;cursor:pointer}
.shv2-drawer .mode:hover{border-color:#E7E2FF}
.shv2-drawer .mode.on{border-color:#6C4FE0;background:#F1EEFF}
.shv2-drawer .mode .mi{width:26px;height:26px;border-radius:7px;background:#FFFFFF;border:1px solid #ECECF3;display:grid;place-items:center;color:#6C4FE0;flex:none}
.shv2-drawer .mode.on .mi{background:#6C4FE0;border-color:#6C4FE0;color:#fff}
.shv2-drawer .mode .mi svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2}
.shv2-drawer .mode b{font-size:12px;font-weight:700;line-height:1.1}
.shv2-drawer .mode span{font-size:10px;color:#7C8092;line-height:1.2;display:block}
/* services chips + categories */
.shv2-drawer .svc-cat{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.shv2-drawer .svc-cat button{font-size:11.5px;font-weight:600;padding:6px 11px;border-radius:20px;border:1px solid #ECECF3;background:#FFFFFF;color:#7C8092;cursor:pointer;transition:.15s}
.shv2-drawer .svc-cat button.on{background:#6C4FE0;color:#fff;border-color:#6C4FE0}
.shv2-drawer .svc-chips{display:flex;flex-wrap:wrap;gap:8px;max-height:220px;overflow-y:auto;padding-right:4px}
.shv2-drawer .svc-chip{display:flex;flex-direction:column;gap:2px;border:1px solid #ECECF3;border-radius:12px;padding:9px 12px;font-size:12.5px;color:#3C3F4E;cursor:pointer;transition:.15s;background:#FFFFFF;min-width:130px;text-align:left}
.shv2-drawer .svc-chip:hover{border-color:#E7E2FF}
.shv2-drawer .svc-chip.on{border-color:#6C4FE0;background:#F1EEFF;color:#6C4FE0}
.shv2-drawer .svc-chip .cn{display:flex;align-items:center;gap:6px;font-weight:700}
.shv2-drawer .svc-chip .pr{font-family:'Plus Jakarta Sans';font-weight:700;font-size:11.5px}
.shv2-drawer .svc-chip .dur{font-size:10.5px;color:#9A9EAE}
.shv2-drawer .svc-chip .rm{width:16px;height:16px;border-radius:50%;background:#6C4FE0;color:#fff;display:none;place-items:center;font-size:10px;font-weight:800;margin-left:auto}
.shv2-drawer .svc-chip.on .rm{display:grid}
/* collapsible section */
.shv2-drawer .coll{border:1px solid #ECECF3;border-radius:12px;margin-bottom:16px;overflow:hidden;background:#FFFFFF}
.shv2-drawer .coll__h{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;cursor:pointer;font-size:13px;font-weight:700;color:#3C3F4E;background:#F6F6FB}
.shv2-drawer .coll__h svg{width:14px;height:14px;transition:.2s;fill:none;stroke:currentColor;stroke-width:2}
.shv2-drawer .coll.open .coll__h svg{transform:rotate(180deg)}
.shv2-drawer .coll__b{padding:12px 14px;display:none}
.shv2-drawer .coll.open .coll__b{display:block}
/* billing */
.shv2-drawer .bill{background:#F6F6FB;border:1px solid #ECECF3;border-radius:12px;padding:14px 16px;margin-top:10px}
.shv2-drawer .bill__row{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:#3C3F4E;padding:5px 0}
.shv2-drawer .bill__row.tot{font-size:15px;font-weight:800;color:#23252F;border-top:1px solid #ECECF3;margin-top:6px;padding-top:10px}
.shv2-drawer .bill__row .discount{color:#2FA96A;font-weight:700}
.shv2-drawer .inline-add{font-size:12px;font-weight:700;color:#6C4FE0;background:none;border:none;cursor:pointer;padding:0}
.shv2-drawer .autosug{position:absolute;top:100%;left:0;right:0;background:#FFFFFF;border:1px solid #ECECF3;border-radius:10px;box-shadow:0 8px 24px rgba(30,32,50,.1);z-index:5;max-height:220px;overflow-y:auto;margin-top:4px}
.shv2-drawer .autosug button{display:block;width:100%;text-align:left;padding:9px 12px;font-size:13px;color:#23252F;border:none;background:none;cursor:pointer;transition:.12s}
.shv2-drawer .autosug button:hover{background:#F1EEFF}
.shv2-drawer .autosug button b{display:block;font-weight:700}
.shv2-drawer .autosug button span{font-size:11.5px;color:#7C8092}

/* toast (shared) */
.shv2-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:#23252F;color:#fff;font-size:13px;font-weight:600;padding:13px 20px;border-radius:12px;box-shadow:0 10px 40px rgba(30,32,50,.14);display:flex;align-items:center;gap:9px;opacity:0;visibility:hidden;transition:.25s;z-index:200}
.shv2-toast.show{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}
.shv2-toast svg{width:17px;height:17px;color:#2FA96A;fill:none;stroke:currentColor;stroke-width:2.5}

/* Booking drawer split layout (left form / right sticky order summary) */
.shv2-drawer .book-split{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,0.85fr);gap:0;flex:1;overflow:hidden;background:#F6F6FB}
.shv2-drawer .book-left{overflow-y:auto;padding:22px 26px;background:#FFFFFF;border-right:1px solid #ECECF3}
.shv2-drawer .book-right{overflow-y:auto;padding:22px 24px;background:#FAFAFF;position:relative}
.shv2-drawer .os{background:#FFFFFF;border:1px solid #ECECF3;border-radius:14px;box-shadow:0 6px 22px rgba(30,32,50,.06);padding:16px}
.shv2-drawer .os__h{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #F3F3F8}
.shv2-drawer .os__h b{font-family:'Plus Jakarta Sans';font-size:14px;font-weight:800;color:#23252F}
.shv2-drawer .os__h .who{font-size:11px;color:#7C8092;font-weight:700}
.shv2-drawer .os-line{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:12.5px;color:#3C3F4E;gap:8px}
.shv2-drawer .os-line .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.shv2-drawer .os-line .p{font-family:'Plus Jakarta Sans';font-weight:800;color:#23252F;font-size:12.5px}
.shv2-drawer .os-empty{font-size:12px;color:#9A9EAE;text-align:center;padding:14px 0;font-weight:600}
.shv2-drawer .os-sec{margin-top:12px;padding-top:12px;border-top:1px dashed #ECECF3}
.shv2-drawer .os-sec .lb{font-size:10.5px;color:#7C8092;font-weight:800;letter-spacing:.4px;text-transform:uppercase;margin-bottom:6px}
.shv2-drawer .os-tot{margin-top:14px;background:#F1EEFF;border-radius:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between}
.shv2-drawer .os-tot .lb{font-size:11.5px;font-weight:800;color:#6C4FE0;letter-spacing:.4px;text-transform:uppercase}
.shv2-drawer .os-tot .val{font-family:'Plus Jakarta Sans';font-size:22px;font-weight:800;color:#6C4FE0;letter-spacing:-.5px}
.shv2-drawer .os-hint{margin-top:10px;font-size:11.5px;color:#7C8092;text-align:center;font-weight:600}

/* Slightly bolder labels/values across drawer */
.shv2-drawer .field label{font-weight:700;color:#3C3F4E}
.shv2-drawer .field input,.shv2-drawer .field select,.shv2-drawer .field textarea{font-weight:600}
.shv2 .kpi__val{font-weight:800;letter-spacing:-.6px}
.shv2 .kpi__lbl{font-weight:800}
.shv2 .brand h1{font-weight:800}

/* Right-column customer detail card (top of book-right) */
.shv2-drawer .cd{background:#FFFFFF;border:1px solid #ECECF3;border-radius:14px;padding:14px;margin-bottom:14px;box-shadow:0 6px 22px rgba(30,32,50,.06)}
.shv2-drawer .cd__h{display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid #F3F3F8;margin-bottom:10px}
.shv2-drawer .cd__h .av{width:42px;height:42px;border-radius:50%;background:#F1EEFF;color:#6C4FE0;display:grid;place-items:center;font-family:'Plus Jakarta Sans';font-weight:800;font-size:16px;background-size:cover;background-position:center;flex:none}
.shv2-drawer .cd__h .who{flex:1;min-width:0}
.shv2-drawer .cd__h .who b{font-family:'Plus Jakarta Sans';font-size:14.5px;font-weight:800;color:#23252F;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shv2-drawer .cd__h .who span{font-size:11.5px;color:#7C8092;font-weight:600}
.shv2-drawer .cd__view{font-size:11px;font-weight:700;color:#6C4FE0;background:#F1EEFF;border:1px solid #E7E2FF;padding:5px 9px;border-radius:8px;cursor:pointer;transition:.15s;flex:none}
.shv2-drawer .cd__view:hover{background:#6C4FE0;color:#fff;border-color:#6C4FE0}
.shv2-drawer .cd-sec{padding:8px 0;border-top:1px dashed #F3F3F8}
.shv2-drawer .cd-sec:first-of-type{border-top:none;padding-top:0}
.shv2-drawer .cd-sec .lb{font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#9A9EAE;margin-bottom:5px}
.shv2-drawer .cd-line{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 0;font-size:12px}
.shv2-drawer .cd-line .k{color:#7C8092;font-weight:600}
.shv2-drawer .cd-line .v{color:#23252F;font-weight:700;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}
.shv2-drawer .cd-line .v.money{font-family:'Plus Jakarta Sans';color:#2FA96A}
.shv2-drawer .cd-line .v.warn{color:#E8952B}
.shv2-drawer .cd-empty{font-size:11.5px;color:#9A9EAE;text-align:center;padding:12px 0;font-weight:600}
.shv2-drawer .cd-badge{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:20px;letter-spacing:.2px}
.shv2-drawer .cd-badge.mem{background:#F1EEFF;color:#6C4FE0}
.shv2-drawer .cd-badge.wallet{background:#E4F6F3;color:#12A594}

/* Guest details card (top of book-right, above Order Details) */
.shv2-drawer .gd-card{background:#FFFFFF;border:1px solid #ECECF3;border-radius:14px;padding:12px 14px;margin-bottom:14px;box-shadow:0 6px 20px rgba(30,32,50,.05)}
.shv2-drawer .gd-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:8px;margin-bottom:6px;border-bottom:1px solid #F3F3F8}
.shv2-drawer .gd-h b{font-family:'Plus Jakarta Sans';font-size:13px;font-weight:800;color:#23252F;letter-spacing:.2px}
.shv2-drawer .gd-full{font-size:10.5px;font-weight:800;color:#6C4FE0;background:#F1EEFF;border:1px solid #E7E2FF;padding:4px 8px;border-radius:8px;cursor:pointer;transition:.15s}
.shv2-drawer .gd-full:hover{background:#6C4FE0;color:#fff;border-color:#6C4FE0}
.shv2-drawer .gd-sec{padding:6px 0;border-top:1px dashed #F3F3F8}
.shv2-drawer .gd-sec:first-of-type{border-top:none;padding-top:2px}
.shv2-drawer .gd-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 0;font-size:11.5px;line-height:1.5}
.shv2-drawer .gd-row .k{color:#7C8092;font-weight:600;flex:none}
.shv2-drawer .gd-row .v{color:#23252F;font-weight:700;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}
.shv2-drawer .gd-empty{font-size:11.5px;color:#9A9EAE;text-align:center;padding:10px 0;font-weight:600}

/* Tab host — hosts non-Home tab pages inside the shell. Neutralises legacy
   fixed backgrounds and full-viewport wrappers so the shell layout owns the
   space between rail (left) and ribbon (right). */
.shv2 .shv2-tabhost{padding:0;min-height:calc(100vh - 68px);background:var(--bg);position:relative;overflow-x:hidden}
.shv2 .shv2-tabhost > .min-h-screen{min-height:auto !important;background:transparent !important;overflow:visible !important}
/* Kill the legacy fixed background/gradient overlay (first child of min-h-screen). */
.shv2 .shv2-tabhost > .min-h-screen > .fixed.inset-0{display:none !important}
/* Hide the legacy header (Salon Dashboard / hamburger / branch chip) — shell topbar replaces it entirely. */
.shv2 .shv2-tabhost > .min-h-screen > .relative.z-10 > div:first-child{display:none !important}
.shv2 .shv2-tabhost > .min-h-screen > .relative.z-10 > .backdrop-blur-xl{display:none !important}
.shv2 .shv2-tabhost .max-w-7xl{max-width:none;margin:0;padding:14px 24px 40px}
.shv2 .shv2-tabhost .container{max-width:none}
/* Hide the hamburger sidebar (the rail replaces it). */
.shv2 .shv2-tabhost aside[class*="fixed"][class*="left-0"][class*="top-0"][class*="bottom-0"]{display:none !important}

/* Full guest profile modal (opened via "View full details") */
.shv2-profile-back{position:fixed;inset:0;background:rgba(28,26,54,.5);backdrop-filter:blur(2px);opacity:0;visibility:hidden;transition:.24s;z-index:90}
.shv2-profile-back.open{opacity:1;visibility:visible}
.shv2-profile{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.96);z-index:100;background:#FFFFFF;width:min(920px,92vw);max-height:88vh;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(28,26,54,.35);opacity:0;visibility:hidden;transition:.28s cubic-bezier(.22,.61,.36,1);display:flex;flex-direction:column;font-family:'Inter',system-ui,sans-serif;color:#23252F}
.shv2-profile.open{opacity:1;visibility:visible;transform:translate(-50%,-50%) scale(1)}
.shv2-profile *{box-sizing:border-box}
.shv2-profile h3,.shv2-profile h4{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800}
.shv2-profile__h{padding:18px 22px;border-bottom:1px solid #ECECF3;display:flex;align-items:center;gap:14px}
.shv2-profile__h .av{width:56px;height:56px;border-radius:50%;background:#F1EEFF;color:#6C4FE0;display:grid;place-items:center;font-family:'Plus Jakarta Sans';font-weight:800;font-size:22px;background-size:cover;background-position:center;flex:none}
.shv2-profile__h .who{flex:1;min-width:0}
.shv2-profile__h h3{font-size:20px}
.shv2-profile__h p{font-size:13px;color:#7C8092;font-weight:600}
.shv2-profile__close{width:36px;height:36px;border-radius:10px;background:#F3F3F8;color:#7C8092;border:none;display:grid;place-items:center;cursor:pointer}
.shv2-profile__close:hover{background:#FCEAF1;color:#E45C86}
.shv2-profile__close svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2}
.shv2-profile__body{padding:20px 22px;overflow-y:auto;flex:1;background:#FAFAFF}
.shv2-profile .p-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px}
.shv2-profile .p-card{background:#FFFFFF;border:1px solid #ECECF3;border-radius:12px;padding:12px 14px}
.shv2-profile .p-card .lb{font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#9A9EAE;margin-bottom:6px}
.shv2-profile .p-card .val{font-family:'Plus Jakarta Sans';font-weight:800;font-size:17px;color:#23252F}
.shv2-profile .p-card .sub{font-size:11px;color:#7C8092;font-weight:600;margin-top:2px}
.shv2-profile h4{font-size:14px;margin:6px 0 10px;color:#3C3F4E}
.shv2-profile .p-details{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;background:#FFFFFF;border:1px solid #ECECF3;border-radius:12px;padding:14px;margin-bottom:16px}
.shv2-profile .p-details .k{font-size:11px;font-weight:700;color:#7C8092}
.shv2-profile .p-details .v{font-size:13px;font-weight:600;color:#23252F;margin-bottom:4px}
.shv2-profile .hist{background:#FFFFFF;border:1px solid #ECECF3;border-radius:12px;overflow:hidden}
.shv2-profile .hist .row{display:grid;grid-template-columns:100px 1fr 80px 90px 90px;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid #F3F3F8;font-size:12.5px;font-weight:600}
.shv2-profile .hist .row.head{background:#F6F6FB;font-size:10.5px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;color:#7C8092}
.shv2-profile .hist .row:last-child{border-bottom:none}
.shv2-profile .hist .badge{font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.2px;justify-self:start}
.shv2-profile .hist .badge.completed{background:#E7F6ED;color:#2FA96A}
.shv2-profile .hist .badge.cancelled{background:#FCEAF1;color:#E45C86}
.shv2-profile .hist .badge.pending{background:#FDF3E4;color:#E8952B}
.shv2-profile .hist .money{font-family:'Plus Jakarta Sans';font-weight:800;color:#23252F;text-align:right}
.shv2-profile__f{padding:12px 22px;border-top:1px solid #ECECF3;display:flex;justify-content:space-between;align-items:center;gap:10px;background:#FFFFFF}

@media(max-width:1150px){
  .shv2 .kgrid{grid-template-columns:repeat(2,1fr)}
  .shv2 .queue{grid-column:1/3 !important;grid-row:auto !important}
  .shv2 .strip{grid-template-columns:repeat(2,1fr)}
  .shv2 .row.a,.shv2 .row.b,.shv2 .row.c{grid-template-columns:1fr 1fr}
  .shv2-drawer .book-split{grid-template-columns:1fr}
  .shv2-drawer .book-left{border-right:none;border-bottom:1px solid #ECECF3}
}
@media(max-width:820px){
  .shv2 .rail,.shv2 .ribbon{display:none}
  .shv2 .main{margin:0}
  .shv2 .searchbox{display:none}
  .shv2 .kgrid,.shv2 .strip,.shv2 .row.a,.shv2 .row.b,.shv2 .row.c{grid-template-columns:1fr}
  .shv2-drawer{width:100vw}
}
`;
