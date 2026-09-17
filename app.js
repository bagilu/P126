'use strict';
const $=s=>document.querySelector(s), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const days=['','週一','週二','週三','週四','週五','週六'];
let api,user,data,tab='compare',draft=[],dirty=false,people=[],chosen=new Set(),comparison=[],groupId='',members=[],search='',filter='',length=1,only=false,checkedAt='';
let mutation=false,authReady=false,authUserId=null;
const fmt=x=>x?new Date(x).toLocaleString('zh-TW',{hour12:false}):'尚未確認';
function notice(text,error=false){const n=$('#notice');n.textContent=text;n.className=error?'error':'';n.hidden=false;}
function hideNotice(){$('#notice').hidden=true;}
async function rpc(action,params={}){const {data:d,error}=await api.rpc('P126Action',{p_action:action,p_data:params});if(error)throw error;return d;}
async function run(fn,button){if(mutation)return;mutation=true;if(button)button.disabled=true;try{await fn();}catch(e){notice(e.message||'操作失敗，請稍後再試。',true);}finally{mutation=false;if(button)button.disabled=false;}}
function openModal(html){$('#modal-content').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
function closeModal(){$('#modal').close();}
function group(){return data.groups.find(g=>g.GroupID===groupId);}
function stamp(){return `<span class="badge ${data.timetable.ConfirmedAt?'':'warn'}">${data.timetable.ConfirmedAt?'已確認完整':'尚未確認完整'}</span>`;}
function safeLeave(){return !dirty||confirm('課表有尚未儲存的修改，確定放棄？');}
async function refresh(){data=await rpc('state');draft=structuredClone(data.slots);dirty=false;}
async function load(){data=await rpc('bootstrap');draft=structuredClone(data.slots);dirty=false;$('#auth').hidden=true;$('#workspace').hidden=false;$('#account').innerHTML=`<span>${esc(user.email)}</span> <button data-act="logout">登出</button>`;if(data.profile.DisplayName==='尚未設定姓名')tab='profile';await showTab(tab);}
async function showTab(next){tab=next;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 if(tab==='compare'){people=await rpc('people');const valid=new Set(people.map(p=>p.UserID));chosen=new Set([...chosen].filter(id=>valid.has(id)));comparison=[];renderCompare();}
 if(tab==='timetable')renderTimetable();if(tab==='profile')renderProfile();if(tab==='groups'){if(!group())groupId=data.groups[0]?.GroupID||'';await renderGroups();}
}
function periodLabel(p){const v=data.periods.find(x=>x.Period===p);return `第${p}節${v?.StartTime?`<small>${esc(v.StartTime.slice(0,5))}<br>${esc(v.EndTime.slice(0,5))}</small>`:''}`;}
function table(cell){let s='<div class="table-wrap"><table><thead><tr><th>節次</th>'+days.slice(1).map(d=>`<th>${d}</th>`).join('')+'</tr></thead><tbody>';for(let p=1;p<=12;p++){s+=`<tr><th>${periodLabel(p)}</th>`;for(let d=1;d<=6;d++)s+=cell(d,p);s+='</tr>';}return s+'</tbody></table></div>';}
function renderTimetable(){
 $('#content').innerHTML=`<div class="toolbar"><div><h2>我的課表</h2><p class="muted">點選格子編輯，可一次設定連續多節。${dirty?' · 有未儲存修改':''}</p></div><div class="row"><button data-act="clear" class="danger">清空課表</button><button data-act="save-draft">儲存草稿</button><button class="primary" data-act="save-confirm">儲存並確認完整</button></div></div><div class="row">${dirty?'<span class="badge warn">編輯中，尚未儲存</span>':stamp()}<small>最後儲存：${fmt(data.timetable.UpdatedAt)}　最後確認：${fmt(data.timetable.ConfirmedAt)}</small></div>`+
 table((d,p)=>{const s=draft.find(s=>s.Day===d&&s.Period===p);return `<td class="${s?'slot-filled':''}"><button data-act="slot" data-day="${d}" data-period="${p}" aria-label="${days[d]}第${p}節 ${esc(s?.Title||'新增行程')}">${s?`${esc(s.Title)}<small>${esc(s.Room)||'未填教室'}</small>`:'＋'}</button></td>`;})+`<p class="hint">空白格在您確認完整後才視為有空。儲存草稿會取消完整確認；完全沒有課，也可以確認空課表。</p>`;
}
function editSlot(day,period){const s=draft.find(s=>s.Day===day&&s.Period===period);openModal(`<h2>${days[day]} · 編輯時段</h2><form id="slot-form"><input type="hidden" name="day" value="${day}"><div class="row"><label>起始節次<select name="start">${periodOptions(period)}</select></label><label>結束節次<select name="end">${periodOptions(period)}</select></label></div><label>類型<select name="kind"><option value="course">課程</option><option value="other" ${s?.Kind==='other'?'selected':''}>其他固定忙碌</option></select></label><label>課名／事項<input name="title" required maxlength="100" value="${esc(s?.Title)}"></label><label>教室／地點<input name="room" maxlength="100" value="${esc(s?.Room)}"></label><p class="muted">套用範圍內的原有內容將被替換。套用後，請記得儲存課表。</p><button class="primary" type="submit">套用至課表</button><button type="button" data-act="remove-slots" class="danger">清除所選節次</button></form>`);}
function periodOptions(p){return Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===p?'selected':''}>第${i+1}節</option>`).join('');}
function applySlots(remove=false){const f=new FormData($('#slot-form')),d=+f.get('day'),a=+f.get('start'),b=+f.get('end');if(a>b)throw Error('結束節次不可早於起始節次');if(!remove&&!String(f.get('title')).trim())throw Error('請輸入課名／事項');draft=draft.filter(s=>s.Day!==d||s.Period<a||s.Period>b);if(!remove)for(let p=a;p<=b;p++)draft.push({Day:d,Period:p,Kind:f.get('kind'),Title:f.get('title').trim(),Room:f.get('room').trim()});dirty=true;closeModal();renderTimetable();}
function renderProfile(){const p=data.profile;$('#content').innerHTML=`<div class="card narrow"><h2>個人資料</h2><p class="muted">姓名與系所供同群組成員辨識。教師／學生身分不會自動授予管理權限。</p><form id="profile-form"><label>姓名<input name="name" maxlength="80" required value="${p.DisplayName==='尚未設定姓名'?'':esc(p.DisplayName)}"></label><label>系所／單位<input name="department" maxlength="120" value="${esc(p.Department)}"></label><label>身分<select name="identity"><option value="student" ${p.Identity==='student'?'selected':''}>學生</option><option value="teacher" ${p.Identity==='teacher'?'selected':''}>教師</option><option value="other" ${p.Identity==='other'?'selected':''}>其他</option></select></label><button type="submit" class="primary">儲存個人資料</button></form><hr><p class="muted">您使用的是好玩實驗室共用帳號。變更密碼將影響所有採用這套帳號的專案。</p><button data-act="password">變更共用密碼</button></div>`;}
async function renderGroups(){const g=group();members=g?await rpc('members',{group_id:g.GroupID}):[];
 $('#content').innerHTML=`<div class="toolbar"><div><h2>我的群組</h2><p class="muted">一份課表，可以加入多個群組。</p></div><div class="row"><button data-act="join">輸入邀請碼</button><button class="primary" data-act="create-group">建立群組</button></div></div><div class="layout"><aside class="card"><h3>群組清單</h3><div class="group-list">${data.groups.map(x=>`<button data-act="select-group" data-id="${x.GroupID}" class="${g?.GroupID===x.GroupID?'selected':''}">${esc(x.Name)}<small> · ${x.OwnerID===user.id?'擁有者':x.Role==='admin'?'管理者':'成員'}</small></button>`).join('')||'<p class="muted">尚未加入群組</p>'}</div></aside><section class="card">${g?`<h2>${esc(g.Name)}</h2><p>${esc(g.Description)}</p><label><input id="share-details" type="checkbox" ${g.ShareDetails?'checked':''}> 向此群組成員分享我的課名與教室</label><p class="muted">未勾選時只分享忙碌狀態。若兩人同時屬於多個群組，任一共同群組已獲授權時即可查看詳細資料。</p><div class="row">${g.Role==='admin'?'<button data-act="rename-group">編輯群組</button><button data-act="invite">產生新邀請碼</button><button data-act="revoke">停用邀請碼</button>':''}${g.OwnerID===user.id?'<button class="danger" data-act="delete-group">刪除群組</button>':'<button class="danger" data-act="leave">退出群組</button>'}</div><div id="invite-output"></div><h3 style="margin-top:24px">成員 · ${members.length} 人</h3>${members.map(m=>`<div class="member"><div><strong>${esc(m.DisplayName)}</strong> <span class="badge">${g.OwnerID===m.UserID?'擁有者':m.Role==='admin'?'管理者':'成員'}</span><small>${esc(m.Department)} · ${m.ConfirmedAt?'已確認 '+fmt(m.ConfirmedAt):'課表尚未確認'}</small></div><div class="row">${g.OwnerID===user.id&&m.UserID!==user.id?`<button data-act="role" data-id="${m.UserID}" data-role="${m.Role==='admin'?'member':'admin'}">${m.Role==='admin'?'取消管理者':'設為管理者'}</button>`:''}${g.Role==='admin'&&m.UserID!==user.id&&m.UserID!==g.OwnerID&&(g.OwnerID===user.id||m.Role!=='admin')?`<button class="danger" data-act="remove-member" data-id="${m.UserID}">移除</button>`:''}</div></div>`).join('')}`:'<div class="empty">建立群組，或向老師／同學索取邀請碼。</div>'}</section></div>`;
}
function visiblePeople(){return people.filter(p=>(!filter||p.GroupIDs.includes(filter))&&`${p.DisplayName} ${p.Department}`.toLowerCase().includes(search.toLowerCase()));}
function renderPicker(){const shown=visiblePeople();$('#people').innerHTML=shown.map(p=>`<label class="person"><input type="checkbox" data-person="${p.UserID}" ${chosen.has(p.UserID)?'checked':''}><span>${esc(p.DisplayName)}${p.UserID===user.id?'（我）':''}<small>${esc(p.Department)} · ${p.ConfirmedAt?'已確認':'尚未確認'}</small></span></label>`).join('')||'<p class="muted">沒有符合的人員</p>';$('#selected-count').textContent=`已選 ${chosen.size} 人`;}
function renderCompare(){if(filter&&!data.groups.some(g=>g.GroupID===filter))filter='';$('#content').innerHTML=`<div class="toolbar"><div><h2>找出共同空堂</h2><p class="muted">選取成員，再查看每一節誰有空、誰忙碌。</p></div><button data-act="reload-people">重新載入成員</button></div><div class="layout"><aside class="card"><h3>參與成員</h3><label>群組<select id="group-filter"><option value="">所有共同群組</option>${data.groups.map(g=>`<option value="${g.GroupID}" ${filter===g.GroupID?'selected':''}>${esc(g.Name)}</option>`).join('')}</select></label><label>搜尋姓名／系所<input id="person-search" value="${esc(search)}" placeholder="輸入關鍵字"></label><div class="row"><button data-act="select-visible">全選目前清單</button><button data-act="clear-selection">清除</button></div><div id="people" class="people"></div><p id="selected-count" class="muted"></p><button class="primary" data-act="compare">開始比對</button></aside><section><div class="card row spread"><label style="margin:0">需要連續 <select id="duration" style="display:inline-block;width:auto;margin:0">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${length===i+1?'selected':''}>${i+1} 節</option>`).join('')}</select></label><label style="margin:0"><input id="only-free" type="checkbox" ${only?'checked':''}> 突顯全員可約時段</label></div><div class="legend"><span><i class="dot"></i>全員可約</span><span><i class="dot partial"></i>部分有空</span><span><i class="dot busy"></i>全員忙碌</span><span><i class="dot unknown"></i>資料未完整</span></div><div id="compare-output"></div></section></div>`;renderPicker();renderResults();}
function renderResults(){if(!comparison.length){$('#compare-output').innerHTML=table(()=>'<td><button disabled>—</button></td>')+'<p class="hint">請選取成員並按下「開始比對」。空白課表尚未確認前，不會被當成有空。</p>';return;}
 const windows=P126Compare.windows(comparison,length),matched=new Set();windows.forEach(w=>{for(let p=w.start;p<=w.end;p++)matched.add(`${w.day}-${p}`);});
 $('#compare-output').innerHTML=`<div class="summary"><strong>${comparison.length} 人 · 找到 ${windows.length} 個連續 ${length} 節的起始時段</strong><small style="display:block">比對時間：${esc(checkedAt)}。課表變更後請重新比對；連續節次可能包含下課或午休，請核對實際時間。</small>${comparison.some(p=>!p.ConfirmedAt)?'<div>部分成員尚未確認完整課表。</div>':''}</div>`+table((d,p)=>{const c=P126Compare.cell(comparison,d,p);const match=matched.has(`${d}-${p}`);return `<td class="cell ${c.state} ${match?'match':''} ${only&&!match?'dim':''}"><button data-act="detail" data-day="${d}" data-period="${p}">${c.unknown?`${c.free}/${c.total} 有空<small>${c.unknown} 人未確認</small>`:c.free===c.total?'全員可約':c.free===0?'全員忙碌':`${c.free}/${c.total} 有空`}</button></td>`;})+`<div class="result-list">${windows.map(w=>`<button data-act="detail" data-day="${w.day}" data-period="${w.start}">${days[w.day]} ${w.start}${w.end!==w.start?'–'+w.end:''}節</button>`).join('')}</div>`;
}
function detail(d,p){const c=P126Compare.cell(comparison,d,p);openModal(`<h2>${days[d]} · 第${p}節</h2>${c.rows.map(r=>`<div class="detail-row"><span><strong>${esc(r.person.DisplayName)}</strong><small style="display:block">最後確認：${fmt(r.person.ConfirmedAt)}</small></span><span>${r.status==='busy'?'忙碌':r.status==='free'?'有空':'尚未確認'}${r.slot?`<small style="display:block">${esc(r.slot.Title??'未分享課程細節')}<br>${esc(r.slot.Room)}</small>`:''}</span></div>`).join('')}`);}
function groupForm(edit=false){const g=edit?group():null;openModal(`<h2>${edit?'編輯':'建立'}群組</h2><form id="group-form" data-edit="${edit}"><label>群組名稱<input name="name" maxlength="80" required value="${esc(g?.Name)}"></label><label>說明<textarea name="description" maxlength="500">${esc(g?.Description)}</textarea></label><button class="primary" type="submit">${edit?'儲存':'建立群組'}</button></form>`);}
function passwordForm(){openModal('<h2>變更共用密碼</h2><p class="hint">此密碼適用於所有使用同一套 Supabase Auth 的專案。</p><form id="password-form"><label>新密碼<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label>再次輸入<input name="again" type="password" minlength="8" autocomplete="new-password" required></label><button type="submit" class="primary">更新密碼</button></form>');}
async function authenticate(mode){if(!api)throw Error('網站尚未完成連線設定，請聯絡管理者。');const email=$('#email').value.trim(),password=$('#password').value;if(!email||!$('#email').checkValidity())throw Error('請輸入有效 Email');let result;
 if(mode==='reset'){result=await api.auth.resetPasswordForEmail(email,{redirectTo:window.P126_CONFIG.redirectUrl});if(result.error)throw result.error;notice('若帳號可使用密碼重設，將收到重設郵件。請查看信箱。');return;}
 if(!password)throw Error('請輸入密碼');
 if(mode==='signup'){if(password.length<8)throw Error('密碼至少8字元');result=await api.auth.signUp({email,password,options:{emailRedirectTo:window.P126_CONFIG.redirectUrl}});}
 else result=await api.auth.signInWithPassword({email,password});
 if(result.error)throw result.error;$('#password').value='';
 if(result.data.session){user=result.data.user;authUserId=user.id;await load();notice('已登入。');}else notice('請查看信箱完成驗證。若已註冊過，請直接登入或重設密碼。');
}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.matches('.close')){closeModal();return;}if(b.dataset.tab){run(async()=>{if(tab==='timetable'&&b.dataset.tab!==tab&&!safeLeave())return;if(dirty){await refresh();}await showTab(b.dataset.tab);},b);return;}
 const act=b.dataset.act;if(!act)return;run(async()=>{
 if(act==='logout'){if(!safeLeave())return;const r=await api.auth.signOut({scope:'local'});if(r.error)throw r.error;location.reload();}
 if(act==='slot')editSlot(+b.dataset.day,+b.dataset.period);
 if(act==='remove-slots')applySlots(true);
 if(act==='clear'&&confirm('清空目前課表？尚需按儲存才會套用。')){draft=[];dirty=true;renderTimetable();}
 if(act==='save-draft'||act==='save-confirm'){if(act==='save-confirm'&&!confirm('確認這份課表已完整？所有空白格將視為有空。'))return;await rpc('save_timetable',{revision:data.timetable.Revision,slots:draft,confirmed:act==='save-confirm'});await refresh();renderTimetable();notice('課表已儲存。');}
 if(act==='password')passwordForm();
 if(act==='create-group')groupForm();if(act==='rename-group')groupForm(true);
 if(act==='select-group'){groupId=b.dataset.id;await renderGroups();}
 if(act==='join')openModal('<h2>加入群組</h2><form id="join-form"><label>邀請碼<input name="code" required maxlength="32" autocomplete="off" placeholder="貼上32字元邀請碼"></label><p class="muted">加入後，同群組成員可查看您的忙碌狀態；課名與教室預設不分享。</p><button type="submit" class="primary">加入群組</button></form>');
 if(act==='invite'){if(!confirm('產生有效7天的新邀請碼？舊邀請碼將立即停用。'))return;const r=await rpc('invite',{group_id:groupId});$('#invite-output').innerHTML=`<p class="muted">請複製傳給成員。此碼只顯示這一次，有效至 ${fmt(r.expires_at)}。</p><div class="code">${esc(r.code)}</div>`;}
 if(act==='revoke'&&confirm('停用此群組所有邀請碼？現有成員不受影響。')){await rpc('revoke_invites',{group_id:groupId});$('#invite-output').innerHTML='';notice('邀請碼已停用。');}
 if(act==='role'){await rpc('set_role',{group_id:groupId,user_id:b.dataset.id,role:b.dataset.role});await renderGroups();}
 if(act==='remove-member'&&confirm('確定移除此成員？其個人課表會保留。')){await rpc('remove_member',{group_id:groupId,user_id:b.dataset.id});await renderGroups();}
 if((act==='leave'||act==='delete-group')&&confirm(act==='leave'?'退出此群組？您的課表會保留。':'刪除整個群組與成員關係？所有人的課表都會保留。')){await rpc(act==='leave'?'leave':'delete_group',{group_id:groupId});await refresh();groupId='';await showTab('groups');}
 if(act==='reload-people'){await refresh();await showTab('compare');}
 if(act==='select-visible'){visiblePeople().forEach(p=>chosen.add(p.UserID));comparison=[];renderPicker();renderResults();}
 if(act==='clear-selection'){chosen.clear();comparison=[];renderPicker();renderResults();}
 if(act==='compare'){if(!chosen.size)throw Error('請先選取至少一人');comparison=await rpc('compare',{user_ids:[...chosen]});checkedAt=new Date().toLocaleString('zh-TW');renderResults();}
 if(act==='detail')detail(+b.dataset.day,+b.dataset.period);
 },b);
});
document.addEventListener('submit',e=>{e.preventDefault();const f=e.target;run(async()=>{
 if(f.id==='login-form')await authenticate('login');
 if(f.id==='slot-form')applySlots();
 if(f.id==='profile-form'){const v=Object.fromEntries(new FormData(f));if(!v.name.trim())throw Error('請輸入姓名');await rpc('profile',v);await refresh();renderProfile();notice('個人資料已儲存，接著可以填寫「我的課表」。');}
 if(f.id==='group-form'){const v=Object.fromEntries(new FormData(f));if(f.dataset.edit==='true'){await rpc('rename_group',{...v,group_id:groupId});}else{const r=await rpc('create_group',v);groupId=r.group_id;}closeModal();await refresh();await renderGroups();}
 if(f.id==='join-form'){const r=await rpc('join',Object.fromEntries(new FormData(f)));groupId=r.group_id;closeModal();await refresh();await renderGroups();notice('已加入群組。');}
 if(f.id==='password-form'){const v=Object.fromEntries(new FormData(f));if(v.password!==v.again)throw Error('兩次密碼不一致');const r=await api.auth.updateUser({password:v.password});if(r.error)throw r.error;closeModal();notice('共用密碼已更新。');}
 },f.querySelector('[type=submit]'));});
document.addEventListener('change',e=>{const t=e.target;
 if(t.dataset.person){t.checked?chosen.add(t.dataset.person):chosen.delete(t.dataset.person);comparison=[];renderPicker();renderResults();}
 if(t.id==='group-filter'){filter=t.value;renderPicker();}
 if(t.id==='duration'){length=+t.value;renderResults();}
 if(t.id==='only-free'){only=t.checked;renderResults();}
 if(t.id==='share-details')run(async()=>{try{await rpc('share',{group_id:groupId,share:t.checked});await refresh();await renderGroups();notice('分享設定已更新。');}catch(e){t.checked=!t.checked;throw e;}});
});
document.addEventListener('input',e=>{if(e.target.id==='person-search'){search=e.target.value;renderPicker();}});
$('#signup').onclick=()=>run(()=>authenticate('signup'),$('#signup'));$('#reset').onclick=()=>run(()=>authenticate('reset'),$('#reset'));
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
async function start(){const c=window.P126_CONFIG;if(!c||!c.supabaseUrl||c.supabaseUrl.includes('YOUR_')||!c.supabaseAnonKey||c.supabaseAnonKey.includes('YOUR_')){notice('網站尚未完成設定：請依部署說明建立 config.js。',true);$('#config-note').textContent='完成連線設定後即可註冊與登入。';$('#login-form').querySelectorAll('button').forEach(b=>b.disabled=true);return;}if(!window.supabase)throw Error('登入元件載入失敗，請檢查網路並重新整理。');
 api=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey,{auth:{storageKey:'p126-auth-token',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 api.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')setTimeout(passwordForm,0);if(event==='SIGNED_OUT'){user=null;authUserId=null;data=null;draft=[];comparison=[];chosen.clear();dirty=false;closeModal();$('#workspace').hidden=true;$('#auth').hidden=false;$('#account').innerHTML='';}if(authReady&&event==='SIGNED_IN'&&session?.user?.id!==authUserId)setTimeout(()=>{if(session.user.id!==authUserId)run(async()=>{user=session.user;authUserId=user.id;await load();});},0);});
 const {data:s,error}=await api.auth.getSession();if(error)throw error;if(s.session){user=s.session.user;authUserId=user.id;await load();}authReady=true;
}
start().catch(e=>notice(e.message,true));
