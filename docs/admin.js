(function(){
  const API_DEFAULT = 'https://workspace-portafolio-api.onrender.com';
  const apiBase = () => { const v=(localStorage.getItem('api_base')||'').trim(); if(!/^https?:\/\//i.test(v) || /github\.io/i.test(v)) return API_DEFAULT; return v.replace(/\/$/,''); };
  const statusEl = document.getElementById('status');
  const loginForm = document.getElementById('loginForm');
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
  function setStatus(ok, txt){ statusEl.textContent = txt; statusEl.className = ok ? 'ok' : 'err'; }

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
      const res = await fetch(apiBase()+'/api/usuarios', { headers: token ? { 'Authorization': 'Bearer '+token } : {} });
      if(!res.ok) throw new Error('Error: '+res.status);
      const users = await res.json();
      usersTbody.innerHTML = '';
      users.forEach(u=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${u.Id}</td><td>${u.Nombre}</td><td>${u.Email||''}</td><td>${new Date(u.FechaRegistro).toLocaleString()}</td><td><button class="selectBtn" data-id="${u.Id}" data-nombre="${u.Nombre}" data-email="${u.Email||''}">Seleccionar</button> <button class="deleteBtn" data-id="${u.Id}">Eliminar</button></td>`;
        usersTbody.appendChild(tr);
      });
      setStatus(true,'Usuarios listados');
    }catch(e){ setStatus(false,'No se pudieron listar usuarios: '+e.message); }
  }

  loginForm.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try{
      const res = await fetch(apiBase()+'/api/login', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if(!res.ok) return setStatus(false, data.error || 'Login falló');
      token = data.token;
      userRole = data.user && data.user.role ? data.user.role : null;
      loginForm.style.display='none'; logoutBtn.style.display='inline-block';
      setStatus(true,'Autenticado como '+((data.user && (data.user.nombre||data.user.email))||'') + ' (' + (userRole||'') + ')');
      // comprobar si la IP es ADMIN_IP (remote) y si el rol es Manager para mostrar panel
      await checkAdminIp();
      if (userRole === 'Manager' && isAdminRemote) {
        showAdminSections(true);
        fetchUsers();
        await loadConfig();
        await loadFiles();
        await fetchSessions();
      } else {
        // no tiene permisos para ver panel admin
        showAdminSections(false);
        setStatus(false, 'Acceso al panel solo para Manager desde ADMIN_IP');
      }
    }catch(e){ setStatus(false,'Error al autenticar: '+e.message); }
  });

  logoutBtn.addEventListener('click', ()=>{ token=null; loginForm.style.display='block'; logoutBtn.style.display='none'; mainSection.style.display='none'; setStatus(false,'Sesión cerrada'); });

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

  async function loadConfig() {
    try{
      const res = await fetch('/admin/config');
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
      const res = await fetch('/admin/config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
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
      const res = await fetch('/admin/config', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { cfgOutput.textContent = 'Conexión fallida: '+(data.error||res.status); cfgTestBtn.disabled = false; return; }
      // If config applied without error, try a lightweight ping: call /api/is-admin-ip
      const ping = await fetch('/api/is-admin-ip');
      if (!ping.ok) { cfgOutput.textContent = 'Conexión aplicada, pero ping falló'; cfgTestBtn.disabled = false; return; }
      cfgOutput.textContent = 'Conexión OK y aplicada temporalmente.';
      cfgTestBtn.disabled = false;
    } catch (e) { cfgOutput.textContent = 'Error testeando conexión: '+e.message; cfgTestBtn.disabled = false; }
  }

  async function runDbInit() {
    if(!confirm('Ejecutar db_init.sql en la instancia configurada? Esto puede crear la base de datos y tablas.')) return;
    runDbInitBtn.disabled = true; cfgOutput.textContent = 'Ejecutando script...';
    try{
      const res = await fetch('/admin/run-db-init', { method:'POST' });
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
      const r = await fetch('/admin/run-db-init', { method:'POST' });
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
      const res = await fetch('/admin/create-sql-login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ loginName, password }) });
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

  filesTableBody.addEventListener('click', async (e)=>{
    const btn = e.target.closest('.fileDeleteBtn');
    if(!btn) return;
    const id = btn.dataset.id;
    if(!confirm('¿Eliminar archivo id '+id+'?')) return;
    try{
      const res = await fetch(apiBase()+'/api/files/'+parseInt(id,10), { method:'DELETE', headers: { 'Authorization': token ? 'Bearer '+token : '' } });
      const ok = res.ok;
      cfgOutput.textContent = ok ? 'Archivo eliminado' : 'Error borrando archivo: '+res.status;
      loadFiles();
    }catch(e){ cfgOutput.textContent = 'Error borrando archivo: '+e.message; }
  });

})();
