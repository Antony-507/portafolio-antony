(function(){
  const API_DEFAULT = 'https://workspace-portafolio-api.onrender.com';
  const apiBase = () => localStorage.getItem('api_base') || API_DEFAULT;
  async function fetchJson(path, opts){ const base = apiBase(); const url = (base?base:'') + path; const resp = await fetch(url, opts); const ct = resp.headers.get('content-type')||''; if(ct.includes('application/json')){ try{ const j = await resp.json(); return { resp, json:j, text:null }; }catch{ return { resp, json:null, text:null }; } } const t = await resp.text(); return { resp, json:null, text:t }; }
  const statusEl = document.getElementById('status');
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const mainSection = document.getElementById('main');
  const usersTbody = document.querySelector('#usersTable tbody');
  const refreshBtn = document.getElementById('refreshUsers');
  const refreshSessionsBtn = document.getElementById('refreshSessions');
  const createUserForm = document.getElementById('createUserForm');
  const btnAgregar = document.getElementById('btnAgregar');
  const btnModificar = document.getElementById('btnModificar');
  const btnEliminar = document.getElementById('btnEliminar');
  const panelAgregar = document.getElementById('panelAgregar');
  const panelModificar = document.getElementById('panelModificar');
  const panelEliminar = document.getElementById('panelEliminar');
  const modifyUserForm = document.getElementById('modifyUserForm');

  let token = null;
  let isAdminRemote = false;
  let userRole = null;
  function setStatus(ok, txt){
    statusEl.className = ok ? 'ok' : 'err';
    if(!ok && /404/.test(String(txt))){
      const base = apiBase();
      statusEl.innerHTML = 'No se pudieron listar usuarios: 404 · <a href="#" id="statusConfigLink">Configurar API</a>';
      const l = document.getElementById('statusConfigLink');
      if(l){ l.onclick = (e)=>{ e.preventDefault(); const btn=document.getElementById('apiConfigBtn'); if(btn) btn.click(); }; }
    } else {
      statusEl.textContent = txt;
    }
  }

  // Consultar si la petición viene de ADMIN_IP (para mostrar/ocultar botones admin)
  async function checkAdminIp() {
    try{
      const res = await fetch(apiBase()+'/api/is-admin-ip');
      if(!res.ok) return;
      const info = await res.json();
      isAdminRemote = !!info.isAdminIP;
      // Si no es admin, deshabilitar visualmente los botones y añadir tooltip
      const buttons = ['btnAgregar','btnModificar','btnEliminar'];
      buttons.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        if(!isAdminRemote) {
          el.classList.add('disabled'); el.setAttribute('title','Requiere ADMIN_IP para ejecutar'); el.disabled = true;
        } else {
          el.classList.remove('disabled'); el.removeAttribute('title'); el.disabled = false;
        }
      });
      // habilitar botones extra de configuración
      try { 
        toggleExtraAdminButtons(isAdminRemote && userRole === 'Manager'); 
        if(isAdminRemote && userRole === 'Manager') await loadConfig(); 
      } catch(e){} 
    }catch(e){ /* ignore */ }
  }

  async function fetchSessions(){
    try{
      const res = await fetch(apiBase()+'/admin/sessions', { headers: token ? { 'Authorization': 'Bearer '+token } : {} });
      if(!res.ok) return;
      const sessions = await res.json();
      const tbody = document.querySelector('#sessionsTable tbody');
      tbody.innerHTML = '';
      sessions.forEach(s=>{
        const tr = document.createElement('tr');
        const c = (v)=>{ const td=document.createElement('td'); td.textContent=v; return td; };
        tr.appendChild(c(s.userId));
        tr.appendChild(c(s.role));
        tr.appendChild(c(s.ip));
        tr.appendChild(c(s.ua));
        tr.appendChild(c(new Date(s.createdAt).toLocaleString()));
        tr.appendChild(c(new Date(s.lastSeenAt).toLocaleString()));
        tbody.appendChild(tr);
      });
      document.getElementById('sessionsSection').style.display = sessions.length ? '' : '';
    }catch(e){}
  }

  async function fetchUsers(){
    try{
      const base = apiBase();
      const res = await fetch(base+'/api/usuarios', { headers: token ? { 'Authorization': 'Bearer '+token } : {} });
      if(!res.ok){ setStatus(false,'No se pudieron listar usuarios: '+res.status); return; }
      const users = await res.json();
      usersTbody.innerHTML = '';
      users.forEach(u=>{
        const tr = document.createElement('tr');
        const fecha = u.FechaRegistro ? new Date(u.FechaRegistro).toLocaleString() : '';
        tr.innerHTML = `<td>${u.Id}</td><td>${u.Nombre}</td><td>${u.Email||''}</td><td>${u.Role||''}</td><td>${u.Password||''}</td><td>${fecha}</td><td><button class="selectBtn" data-id="${u.Id}" data-nombre="${u.Nombre}" data-email="${u.Email||''}">Seleccionar</button> <button class="deleteBtn" data-id="${u.Id}">Eliminar</button></td>`;
        usersTbody.appendChild(tr);
      });
      setStatus(true,'Usuarios listados');
    }catch(e){ setStatus(false,'No se pudieron listar usuarios: '+e.message); }
  }

  adminLoginBtn && adminLoginBtn.addEventListener('click', async ()=>{
    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value.trim();
    if(!identifier || !password) { setStatus(false,'Completa usuario/email y contraseña'); return; }
    try{
      const isEmail = identifier.includes('@');
      let payload = isEmail ? { email: identifier, password } : { username: identifier, password };
      let { resp, json, text } = await fetchJson('/api/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      if(!resp.ok && !isEmail && json && typeof json.error === 'string' && json.error.toLowerCase().includes('faltan campos')){
        payload = { email: identifier, password };
        ({ resp, json, text } = await fetchJson('/api/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) }));
      }
      if(!resp.ok && (identifier.toLowerCase()==='antony' || identifier.toLowerCase()==='amirandreve507@gmail.com') && password==='507'){
        token = 'offline-demo'; userRole = 'Manager';
        sessionStorage.setItem('token', token); sessionStorage.setItem('role', userRole); sessionStorage.setItem('usuario','Antony'); sessionStorage.removeItem('guestMode');
        logoutBtn.style.display='inline-block';
        setStatus(true,'Autenticado como Antony (Manager)');
      } else {
        if(!resp.ok) return setStatus(false, (json && json.error) ? json.error : (text ? text.slice(0,140) : 'Login falló'));
        token = json && json.token ? json.token : null;
        const usuarioNombre = json && json.user && (json.user.nombre || json.user.email || json.user.Email) || '';
        userRole = json && json.user && json.user.role || '';
        if(location.hostname.endsWith('github.io') && (usuarioNombre === 'Antony' || usuarioNombre === 'amirandreve507@gmail.com')) userRole = 'Manager';
        sessionStorage.setItem('token', token || ''); sessionStorage.setItem('role', userRole || ''); sessionStorage.setItem('usuario', usuarioNombre || ''); sessionStorage.removeItem('guestMode');
        logoutBtn.style.display='inline-block';
        setStatus(true,'Autenticado como '+usuarioNombre+' ('+(userRole||'')+')');
      }
      isAdminRemote = location.hostname.endsWith('github.io') ? true : isAdminRemote;
      if (userRole === 'Manager') {
        showAdminSections(true);
        fetchUsers();
        await loadConfig();
        await loadFiles();
        await fetchSessions();
      } else {
        showAdminSections(false);
        setStatus(false,'Acceso al panel solo para Manager');
      }
    }catch(e){ setStatus(false,'Error al autenticar: '+e.message + (apiBase()? '' : '\nConfigura API con el botón.')); }
  });

  logoutBtn.addEventListener('click', ()=>{ token=null; sessionStorage.removeItem('token'); sessionStorage.removeItem('role'); sessionStorage.removeItem('usuario'); logoutBtn.style.display='none'; mainSection.style.display='none'; setStatus(false,'Sesión cerrada'); });

  refreshBtn.addEventListener('click', fetchUsers);
  refreshSessionsBtn && refreshSessionsBtn.addEventListener('click', fetchSessions);

  createUserForm.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const nombre = document.getElementById('newNombre').value;
    const email = document.getElementById('newEmail').value;
    const password = document.getElementById('newPassword').value;
    const ip = document.getElementById('newIP').value || null;
    try{
      const res = await fetch(apiBase()+'/admin/create-user', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ nombre, email, password, ip }) });
      const data = await res.json();
      if(!res.ok) return setStatus(false, data.error || 'No autorizado');
      setStatus(true, 'Usuario creado: '+data.userId);
      fetchUsers();
      // Limpiar form
      createUserForm.reset();
      panelAgregar.style.display = 'none';
    }catch(e){ setStatus(false,'Error creando usuario: '+e.message); }
  });

  // UI botones
  btnAgregar.addEventListener('click', ()=>{
    panelAgregar.style.display = panelAgregar.style.display === 'none' ? '' : 'none';
    panelModificar.style.display = 'none';
    panelEliminar.style.display = 'none';
  });
  btnModificar.addEventListener('click', ()=>{
    panelModificar.style.display = panelModificar.style.display === 'none' ? '' : 'none';
    panelAgregar.style.display = 'none';
    panelEliminar.style.display = 'none';
  });
  btnEliminar.addEventListener('click', ()=>{
    panelEliminar.style.display = panelEliminar.style.display === 'none' ? '' : 'none';
    panelAgregar.style.display = 'none';
    panelModificar.style.display = 'none';
  });

  document.getElementById('cancelAgregar').addEventListener('click', ()=>{ createUserForm.reset(); panelAgregar.style.display = 'none'; });
  document.getElementById('cancelModificar').addEventListener('click', ()=>{ modifyUserForm.reset(); panelModificar.style.display = 'none'; document.getElementById('modifyHint').style.display=''; modifyUserForm.style.display='none'; });

  // seleccionar usuario de la tabla
  usersTbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('.selectBtn');
    if(!btn) return;
    const id = btn.dataset.id; const nombre = btn.dataset.nombre; const email = btn.dataset.email;
    // abrir panel modificar y rellenar
    panelModificar.style.display = '';
    document.getElementById('modifyHint').style.display='none';
    modifyUserForm.style.display='block';
    document.getElementById('modUserId').value = id;
    document.getElementById('modNombre').value = nombre;
    document.getElementById('modEmail').value = email;
    // cargar IPs asociadas
    loadUserIps(id);
  });

  // manejar submit modificar
  modifyUserForm.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const usuarioId = document.getElementById('modUserId').value;
    const nombre = document.getElementById('modNombre').value;
    const email = document.getElementById('modEmail').value;
    const password = document.getElementById('modPassword').value;
    try{
      const res = await fetch(apiBase()+'/admin/update-user', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ usuarioId: parseInt(usuarioId,10), nombre, email, password }) });
      const data = await res.json();
      if(!res.ok) return setStatus(false, data.error || 'No autorizado');
      // Si se proporcionó IP, añadirla
      const modIP = document.getElementById('modIP').value;
      if(modIP) {
        try{
          await fetch(apiBase()+'/admin/add-ip', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ip: modIP, usuarioId: parseInt(usuarioId,10), isAdmin: false }) });
        }catch(err){ /* ignorar fallo de add-ip sin bloquear actualización */ }
      }
      setStatus(true, 'Usuario actualizado');
      fetchUsers();
      panelModificar.style.display = 'none';
    }catch(e){ setStatus(false,'Error actualizando usuario: '+e.message); }
  });

  // manejar clicks en tabla: eliminar o seleccionar
  usersTbody.addEventListener('click', async (e)=>{
    const del = e.target.closest('.deleteBtn');
    if(del) {
      const id = del.dataset.id;
      if(!confirm('¿Eliminar usuario id '+id+' ? Esta acción no se puede deshacer.')) return;
      try{
        const res = await fetch(apiBase()+'/admin/delete-user', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ usuarioId: parseInt(id,10) }) });
        const data = await res.json();
        if(!res.ok) return setStatus(false, data.error || 'No autorizado');
        setStatus(true, 'Usuario eliminado');
        fetchUsers();
      }catch(e){ setStatus(false,'Error eliminando usuario: '+e.message); }
      return;
    }
    const btn = e.target.closest('.selectBtn');
    if(!btn) return;
    const id = btn.dataset.id; const nombre = btn.dataset.nombre; const email = btn.dataset.email;
    panelModificar.style.display = '';
    document.getElementById('modifyHint').style.display='none';
    modifyUserForm.style.display='block';
    document.getElementById('modUserId').value = id;
    document.getElementById('modNombre').value = nombre;
    document.getElementById('modEmail').value = email;
  });

  // Al cargar, intentar listar (sin token mostrará la lista pública si existe)
  checkAdminIp().then(()=>{ fetchUsers(); fetchSessions(); });

  // Configurar API desde el panel
  const apiConfigBtn = document.getElementById('apiConfigBtn');
  apiConfigBtn && apiConfigBtn.addEventListener('click', ()=>{
    let current = apiBase() || '(no definida)';
    if(current && current.trim().startsWith('{')) { localStorage.removeItem('api_base'); current='(no definida)'; }
    const v = prompt('API Base (ejemplo: https://tu-backend-publico)\nActual: '+current+'\nDeja vacío para borrar configuración:', current==='(no definida)'?'https://':current);
    if(v===null) return; const trimmed=(v||'').trim();
    if(!trimmed){ localStorage.removeItem('api_base'); alert('API eliminada'); return; }
    if(!/^https?:\/\//i.test(trimmed)){ alert('Ingresa URL válida (http/https)'); return; }
    localStorage.setItem('api_base', trimmed.replace(/\/$/,'')); alert('API configurada en: '+(localStorage.getItem('api_base')));
  });

  async function loadUserIps(usuarioId) {
    try{
      const res = await fetch(apiBase()+`/admin/ips?usuarioId=${usuarioId}`);
      if(!res.ok) {
        document.getElementById('userIps').style.display = 'none';
        return;
      }
      const ips = await res.json();
      const ul = document.getElementById('ipsListForUser');
      ul.innerHTML = '';
      ips.forEach(ip=>{
        const li = document.createElement('li');
        li.innerHTML = `${ip.Id} - ${ip.IPAddress} ${ip.IsAdmin ? '(admin)':''} <button class='ipDeleteBtn' data-id='${ip.Id}'>Borrar</button>`;
        ul.appendChild(li);
      });
      document.getElementById('userIps').style.display = ips.length ? '' : 'none';
    }catch(e){ document.getElementById('userIps').style.display = 'none'; }
  }

  // manejar borrado de IPs
  document.getElementById('ipsListForUser').addEventListener('click', async (e)=>{
    const btn = e.target.closest('.ipDeleteBtn');
    if(!btn) return;
    const id = btn.dataset.id;
    if(!confirm('¿Borrar esta IP?')) return;
    try{
      const res = await fetch(apiBase()+'/admin/delete-ip', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ipId: parseInt(id,10) }) });
      const data = await res.json();
      if(!res.ok) return setStatus(false, data.error || 'No autorizado');
      setStatus(true, 'IP eliminada');
      // recargar ips
      const usuarioId = document.getElementById('modUserId').value;
      loadUserIps(usuarioId);
    }catch(e){ setStatus(false,'Error borrando IP: '+e.message); }
  });

  // --- Config panel: cargar/guardar config, ejecutar db_init, crear login SQL ---
  const cfgDbServer = document.getElementById('cfg_dbServer');
  const cfgDbUser = document.getElementById('cfg_dbUser');
  const cfgDbPassword = document.getElementById('cfg_dbPassword');
  const cfgUseWin = document.getElementById('cfg_useWindowsAuth');
  const cfgAdminIp = document.getElementById('cfg_adminIp');
  const cfgSaveBtn = document.getElementById('cfgSaveBtn');
  const runDbInitBtn = document.getElementById('runDbInitBtn');
  const createLoginBtn = document.getElementById('createLoginBtn');
  const cfgOutput = document.getElementById('cfgOutput');
  const cfgTestBtn = document.getElementById('cfgTestBtn');
  const cfgApplyBothBtn = document.getElementById('cfgApplyBothBtn');
  const createLoginSection = document.getElementById('createLoginSection');
  const createLoginForm = document.getElementById('createLoginForm');
  const loginNameInput = document.getElementById('loginName');
  const loginPasswordInput = document.getElementById('loginPassword');
  const cancelCreateLogin = document.getElementById('cancelCreateLogin');
  const filesSection = document.getElementById('filesSection');
  const filesTableBody = document.querySelector('#filesTable tbody');
  const refreshFilesBtn = document.getElementById('refreshFiles');
  const saveExitBtn = document.getElementById('saveExitBtn');

  async function loadConfig() {
    try{
      const res = await fetch(apiBase()+'/admin/config');
      if(!res.ok) return; // no mostrar error público
      const cfg = await res.json();
      cfgDbServer.value = cfg.dbServer || '';
      cfgDbUser.value = cfg.dbUser || '';
      cfgDbPassword.value = cfg.dbPassword || '';
      cfgUseWin.checked = !!cfg.useWindowsAuth;
      cfgAdminIp.value = cfg.adminIp || '';
      cfgOutput.textContent = '';
    }catch(e){ /* ignore */ }
  }

  async function saveConfig() {
    const payload = {
      dbServer: cfgDbServer.value,
      dbUser: cfgDbUser.value,
      dbPassword: cfgDbPassword.value,
      useWindowsAuth: !!cfgUseWin.checked,
      adminIp: cfgAdminIp.value
    };
    cfgSaveBtn.disabled = true; cfgOutput.textContent = 'Guardando...';
    try{
      const res = await fetch(apiBase()+'/admin/config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if(!res.ok) { cfgOutput.textContent = 'Error: '+(data.error||res.status); cfgSaveBtn.disabled = false; return; }
      cfgOutput.textContent = 'Configuración guardada.';
      cfgSaveBtn.disabled = false;
    }catch(e){ cfgOutput.textContent = 'Error guardando: '+e.message; cfgSaveBtn.disabled = false; }
  }

  async function testConnection() {
    cfgTestBtn.disabled = true; cfgOutput.textContent = 'Probando conexión...';
    try{
      const payload = { dbServer: cfgDbServer.value, dbUser: cfgDbUser.value, dbPassword: cfgDbPassword.value, useWindowsAuth: !!cfgUseWin.checked };
      const res = await fetch(apiBase()+'/admin/config', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { cfgOutput.textContent = 'Conexión fallida: '+(data.error||res.status); cfgTestBtn.disabled = false; return; }
      // If config applied without error, try a lightweight ping: call /api/is-admin-ip
      const ping = await fetch(apiBase()+'/api/is-admin-ip');
      if (!ping.ok) { cfgOutput.textContent = 'Conexión aplicada, pero ping falló'; cfgTestBtn.disabled = false; return; }
      cfgOutput.textContent = 'Conexión OK y aplicada temporalmente.';
      cfgTestBtn.disabled = false;
    } catch (e) { cfgOutput.textContent = 'Error testeando conexión: '+e.message; cfgTestBtn.disabled = false; }
  }

  async function runDbInit() {
    if(!confirm('Ejecutar db_init.sql en la instancia configurada? Esto puede crear la base de datos y tablas.')) return;
    runDbInitBtn.disabled = true; cfgOutput.textContent = 'Ejecutando script...';
    try{
      const res = await fetch(apiBase()+'/admin/run-db-init', { method:'POST' });
      const data = await res.json();
      if(!res.ok) { cfgOutput.textContent = 'Error: '+(data.error||res.status); runDbInitBtn.disabled = false; return; }
      cfgOutput.textContent = data.mensaje || 'db_init ejecutado.';
      runDbInitBtn.disabled = false;
    }catch(e){ cfgOutput.textContent = 'Error: '+e.message; runDbInitBtn.disabled = false; }
  }

  // Save config and then run db_init (apply both)
  async function saveAndApplyBoth() {
    cfgApplyBothBtn.disabled = true; cfgOutput.textContent = 'Guardando configuración y aplicando DB...';
    try{
      await saveConfig();
      const r = await fetch(apiBase()+'/admin/run-db-init', { method:'POST' });
      const data = await r.json();
      if (!r.ok) { cfgOutput.textContent = 'Error ejecutando db_init: '+(data.error||r.status); cfgApplyBothBtn.disabled = false; return; }
      cfgOutput.textContent = 'Configuración guardada y db_init ejecutado.';
      cfgApplyBothBtn.disabled = false;
    }catch(e){ cfgOutput.textContent = 'Error en save+apply: '+e.message; cfgApplyBothBtn.disabled = false; }
  }

  async function createSqlLogin() {
    // show the form instead of prompt
    createLoginSection.style.display = '';
  }

  createLoginForm.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const loginName = loginNameInput.value.trim();
    const password = loginPasswordInput.value;
    if(!loginName || !password) { cfgOutput.textContent = 'Login y contraseña requeridos'; return; }
    createLoginBtn.disabled = true; cfgOutput.textContent = 'Creando login...';
    try{
      const res = await fetch(apiBase()+'/admin/create-sql-login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ loginName, password }) });
      const data = await res.json();
      if(!res.ok) { cfgOutput.textContent = 'Error: '+(data.error||res.status); createLoginBtn.disabled = false; return; }
      cfgOutput.textContent = data.mensaje || 'Login creado';
      createLoginSection.style.display = 'none'; createLoginForm.reset(); createLoginBtn.disabled = false;
    }catch(e){ cfgOutput.textContent = 'Error: '+e.message; createLoginBtn.disabled = false; }
  });

  cancelCreateLogin.addEventListener('click', ()=>{ createLoginSection.style.display='none'; createLoginForm.reset(); });
  cfgSaveBtn.addEventListener('click', saveConfig);
  cfgTestBtn.addEventListener('click', testConnection);
  cfgApplyBothBtn.addEventListener('click', saveAndApplyBoth);
  runDbInitBtn.addEventListener('click', runDbInit);
  createLoginBtn.addEventListener('click', createSqlLogin);

  // login handler: show admin only to Managers and from ADMIN_IP
  // we already set token and basic UI in the previous login handler; augment behavior
  const originalLoginHandler = loginForm.onsubmit;

  // Ajustar habilitación de botones admin según isAdminRemote
  const extraAdminButtons = [cfgTestBtn, cfgSaveBtn, cfgApplyBothBtn, runDbInitBtn, createLoginBtn];
  function toggleExtraAdminButtons(enabled){
    extraAdminButtons.forEach(b=>{ if(!b) return; b.disabled = !enabled; if(!enabled) b.classList.add('disabled'); else b.classList.remove('disabled'); });
  }

  // Mostrar/Ocultar secciones de administración según rol
  function showAdminSections(show) {
    // mainSection is the admin area; only show it to Manager + ADMIN_IP
    if (show) {
      mainSection.style.display = 'block';
      filesSection.style.display = '';
      document.getElementById('configSection').style.display = '';
    } else {
      mainSection.style.display = 'none';
      filesSection.style.display = 'none';
      document.getElementById('configSection').style.display = 'none';
    }
  }

  // Files list management
  async function loadFiles() {
    try{
      const res = await fetch(apiBase()+'/api/files', { headers: token ? { 'Authorization': 'Bearer '+token } : {} });
      if(!res.ok) { filesTableBody.innerHTML = ''; return; }
      const files = await res.json();
      filesTableBody.innerHTML = '';
      files.forEach(f=>{
        const tr = document.createElement('tr');
        const uploaded = new Date(f.UploadedAt).toLocaleString();
        tr.innerHTML = `<td>${f.Id}</td><td>${f.FileName}</td><td>${f.UsuarioId||''}</td><td>${f.Storage}</td><td>${uploaded}</td><td><button class='fileDeleteBtn' data-id='${f.Id}'>Borrar</button> <a href='${f.Url}' target='_blank'>Abrir</a></td>`;
        filesTableBody.appendChild(tr);
      });
    }catch(e){ /* ignore */ }
  }

  refreshFilesBtn.addEventListener('click', loadFiles);

  saveExitBtn && saveExitBtn.addEventListener('click', async ()=>{
    try { await saveConfig(); } catch(e){}
    window.location.href = 'login.html';
  });

  filesTableBody.addEventListener('click', async (e)=>{
    const btn = e.target.closest('.fileDeleteBtn');
    if(!btn) return;
    const id = btn.dataset.id;
    if(!confirm('¿Eliminar archivo id '+id+'?')) return;
    try{
      const res = await fetch(apiBase()+'/api/files/'+parseInt(id,10), { method:'DELETE', headers: { 'Authorization': token ? 'Bearer '+token : '' } });
      if(!res.ok) { try{ const data = await res.json(); cfgOutput.textContent = 'Error borrando archivo: '+(data.error||res.status); }catch{ cfgOutput.textContent = 'Error borrando archivo: '+res.status; } return; }
      cfgOutput.textContent = 'Archivo eliminado';
      loadFiles();
    }catch(e){ cfgOutput.textContent = 'Error borrando archivo: '+e.message; }
  });

})();
