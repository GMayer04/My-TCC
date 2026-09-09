// =====================================================================
// PAINEL ADMIN — login, CRUD de eventos, relatório de agendamentos, config de dias
// =====================================================================

const DIAS_SEMANA = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

// ---- Utilidades de data (mesmas regras do site público) ----
function todayDateOnly(){
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}
function formatDateStr(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function getSemanaAtual(){
  const hoje = todayDateOnly();
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - hoje.getDay());
  const sabado = new Date(domingo);
  sabado.setDate(domingo.getDate() + 6);
  return { inicio: formatDateStr(domingo), fim: formatDateStr(sabado) };
}
function computeWeekStartStr(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  return formatDateStr(d);
}

// =====================================================================
// LOGIN DO ADMIN
// =====================================================================
function iniciarAuthListener(){
  if(!window.auth){
    setTimeout(iniciarAuthListener, 200);
    return;
  }
  window.fbOnAuthStateChanged(window.auth, async (user) => {
    if(!user){
      mostrarLogin();
      return;
    }
    try{
      const snap = await window.fbGetDoc(window.fbDoc(window.db, 'admins', user.uid));
      if(snap.exists()){
        mostrarPainel(user.email);
      } else {
        document.getElementById('adminLoginError').textContent = 'Essa conta não tem permissão de administrador.';
        window.fbSignOut(window.auth);
      }
    }catch(e){
      console.error('Erro ao checar permissão de admin:', e);
      document.getElementById('adminLoginError').textContent = 'Essa conta não tem permissão de administrador.';
      window.fbSignOut(window.auth);
    }
  });
}
iniciarAuthListener();

function mostrarLogin(){
  document.getElementById('adminLoginGate').style.display = '';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('adminHeaderInfo').style.display = 'none';
}

function mostrarPainel(email){
  document.getElementById('adminLoginGate').style.display = 'none';
  document.getElementById('adminPanel').style.display = '';
  const info = document.getElementById('adminHeaderInfo');
  info.style.display = '';
  info.innerHTML = `${email} · <a href="#" id="adminLogoutLink">Sair</a>`;
  document.getElementById('adminLogoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.fbSignOut(window.auth);
  });
  escutarEventos();
  carregarConfigDias();
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value.trim();
  const senha = document.getElementById('adminSenha').value;
  const errorEl = document.getElementById('adminLoginError');
  const btn = document.getElementById('adminLoginBtn');
  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Entrando...';
  try{
    await window.fbSignIn(window.auth, email, senha);
  }catch(err){
    errorEl.textContent = 'E-mail ou senha incorretos.';
  }
  btn.disabled = false;
  btn.textContent = 'Entrar';
});

// ---- Navegação entre abas ----
document.querySelectorAll('.admin-tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-panel').forEach(p => p.style.display = 'none');
    tabBtn.classList.add('active');
    document.getElementById(`tab-${tabBtn.dataset.tab}`).style.display = '';
  });
});

// ---- Comprime/redimensiona a imagem escolhida (limite do Firestore é 1MB por documento) ----
function comprimirImagem(arquivo, callback){
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX_LADO = 700;
      let { width, height } = img;
      if(width > height && width > MAX_LADO){
        height = Math.round(height * (MAX_LADO / width));
        width = MAX_LADO;
      } else if(height > MAX_LADO){
        width = Math.round(width * (MAX_LADO / height));
        height = MAX_LADO;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(arquivo);
}

// =====================================================================
// ABA EVENTOS — CRUD completo (foto, título, data/hora, descrição, link)
// =====================================================================
function escutarEventos(){
  window.fbOnSnapshot(window.fbCollection(window.db, 'eventos'), (snapshot) => {
    const eventos = [];
    snapshot.forEach(d => eventos.push(Object.assign({ id: d.id }, d.data())));
    renderEventosAdmin(eventos);
  });
}

function renderEventosAdmin(eventos){
  const container = document.getElementById('eventosAdminList');
  if(!eventos.length){
    container.innerHTML = `<p class="admin-muted">Nenhum evento cadastrado ainda. Clique em "+ Novo evento" para criar o primeiro.</p>`;
    return;
  }
  container.innerHTML = eventos.map(ev => `
    <div class="admin-event-row" data-id="${ev.id}">
      <div class="admin-event-thumb-wrap">
        <img src="${ev.imgData || ev.img || ''}" alt="" class="admin-event-thumb admin-event-preview" onerror="this.style.opacity=0.2">
      </div>
      <div class="admin-event-fields">
        <label class="field-label">Título</label>
        <input type="text" class="ev-titulo" value="${(ev.title || '').replace(/"/g,'&quot;')}" placeholder="Título do evento">

        <label class="field-label">Imagem (escolha um arquivo do computador)</label>
        <input type="file" class="ev-imagem-arquivo" accept="image/*">
        <p class="admin-field-hint">Ou, se preferir, cole o caminho/link de uma imagem já existente:</p>
        <input type="text" class="ev-imagem" value="${(ev.img || '').replace(/"/g,'&quot;')}" placeholder="images/evento.png ou https://...">

        <label class="field-label">Data / horário / local</label>
        <input type="text" class="ev-datahora" value="${(ev.time || '').replace(/"/g,'&quot;')}" placeholder="Ex: 02 AGO · 19h — Salão Social">

        <label class="field-label">Descrição</label>
        <textarea class="ev-descricao" rows="2" placeholder="Descrição do evento">${ev.description || ''}</textarea>

        <label class="field-label">Link (opcional)</label>
        <input type="text" class="ev-link" value="${(ev.link || '').replace(/"/g,'&quot;')}" placeholder="https://...">
      </div>
      <div class="admin-event-actions">
        <button type="button" class="admin-btn-salvar">Salvar</button>
        <button type="button" class="admin-btn-excluir">Excluir</button>
      </div>
    </div>
  `).join('');

  // ---- Preview + compressão da imagem escolhida do computador (guardada em base64 no Firestore) ----
  container.querySelectorAll('.admin-event-row').forEach(row => {
    row._imgDataPendente = null; // guarda a imagem convertida até a pessoa clicar em Salvar
    const fileInput = row.querySelector('.ev-imagem-arquivo');
    const preview = row.querySelector('.admin-event-preview');
    fileInput.addEventListener('change', () => {
      const arquivo = fileInput.files[0];
      if(!arquivo) return;
      comprimirImagem(arquivo, (dataUrl) => {
        row._imgDataPendente = dataUrl;
        preview.src = dataUrl;
        preview.style.opacity = 1;
      });
    });
  });

  container.querySelectorAll('.admin-event-row').forEach(row => {
    const id = row.dataset.id;

    row.querySelector('.admin-btn-salvar').addEventListener('click', async () => {
      const dados = {
        title: row.querySelector('.ev-titulo').value.trim(),
        img: row.querySelector('.ev-imagem').value.trim(),
        time: row.querySelector('.ev-datahora').value.trim(),
        description: row.querySelector('.ev-descricao').value.trim(),
        link: row.querySelector('.ev-link').value.trim()
      };
      if(row._imgDataPendente){
        dados.imgData = row._imgDataPendente; // imagem enviada do computador, prioridade sobre o link
      }
      try{
        await window.fbUpdateDoc(window.fbDoc(window.db, 'eventos', id), dados);
      }catch(e){
        console.error('Erro ao salvar evento:', e);
        alert('Não foi possível salvar. Veja o console para detalhes.');
      }
    });

    row.querySelector('.admin-btn-excluir').addEventListener('click', async () => {
      if(!confirm('Excluir esse evento? Essa ação não pode ser desfeita.')) return;
      try{
        await window.fbDeleteDoc(window.fbDoc(window.db, 'eventos', id));
      }catch(e){
        console.error('Erro ao excluir evento:', e);
        alert('Não foi possível excluir. Veja o console para detalhes.');
      }
    });
  });
}

document.getElementById('btnNovoEvento').addEventListener('click', async () => {
  try{
    await window.fbAddDoc(window.fbCollection(window.db, 'eventos'), {
      title: 'Novo evento',
      img: '',
      time: '',
      description: '',
      link: '',
      criadoEm: window.fbServerTimestamp()
    });
  }catch(e){
    console.error('Erro ao criar evento:', e);
    alert('Não foi possível criar o evento. Veja o console para detalhes.');
  }
});

// =====================================================================
// ABA AGENDAMENTOS — relatório da semana, com edição e exclusão
// =====================================================================
let agendamentosCarregados = [];

document.getElementById('btnCarregarAgendamentos').addEventListener('click', async () => {
  const btn = document.getElementById('btnCarregarAgendamentos');
  btn.disabled = true;
  btn.textContent = 'Carregando...';
  try{
    const { inicio, fim } = getSemanaAtual();
    const q = window.fbQuery(
      window.fbCollection(window.db, 'agendamentos'),
      window.fbWhere('data', '>=', inicio),
      window.fbWhere('data', '<=', fim)
    );
    const snap = await window.fbGetDocs(q);
    const agendamentos = [];
    snap.forEach(d => agendamentos.push(Object.assign({ id: d.id }, d.data())));
    agendamentos.sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));
    agendamentosCarregados = agendamentos;
    renderAgendamentosTable(agendamentos);
    document.getElementById('btnBaixarPdf').style.display = agendamentos.length ? '' : 'none';
  }catch(e){
    console.error('Erro ao carregar agendamentos:', e);
    alert('Não foi possível carregar os agendamentos. Veja o console para detalhes.');
  }
  btn.disabled = false;
  btn.textContent = 'Carregar';
});

document.getElementById('btnBaixarPdf').addEventListener('click', () => {
  if(!agendamentosCarregados.length) return;
  const { inicio, fim } = getSemanaAtual();
  const nomeServico = (s) => s === 'cal-manicure' ? 'Manicure' : (s === 'cal-massage' ? 'Massagem' : (s || ''));
  const dataFormatada = (d) => d ? d.split('-').reverse().join('/') : '';

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Grêmio Social Recreativo Miracema', 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`Relatório de agendamentos — semana de ${dataFormatada(inicio)} a ${dataFormatada(fim)}`, 14, 26);
  doc.setTextColor(0);

  doc.autoTable({
    startY: 34,
    head: [['Serviço', 'Data', 'Horário', 'Nome', 'Contato', 'Crachá']],
    body: agendamentosCarregados.map(ag => [
      nomeServico(ag.servico), dataFormatada(ag.data), ag.horario || '', ag.nome || '', ag.contato || '', ag.cracha || ''
    ]),
    headStyles: { fillColor: [18, 148, 106] },
    styles: { fontSize: 9, cellPadding: 4 },
    alternateRowStyles: { fillColor: [244, 248, 246] }
  });

  doc.save(`agendamentos_${inicio}_a_${fim}.pdf`);
});

function renderAgendamentosTable(agendamentos){
  const table = document.getElementById('agendamentosTable');
  const tbody = document.getElementById('agendamentosTableBody');
  const vazio = document.getElementById('agendamentosVazio');

  if(!agendamentos.length){
    table.style.display = 'none';
    vazio.style.display = '';
    vazio.textContent = 'Nenhum agendamento encontrado para a semana atual.';
    return;
  }
  vazio.style.display = 'none';
  table.style.display = '';

  tbody.innerHTML = agendamentos.map(ag => `
    <tr data-id="${ag.id}">
      <td><input type="text" class="ag-servico" value="${(ag.servico || '').replace(/"/g,'&quot;')}"></td>
      <td><input type="text" class="ag-data" value="${(ag.data || '').replace(/"/g,'&quot;')}"></td>
      <td><input type="text" class="ag-horario" value="${(ag.horario || '').replace(/"/g,'&quot;')}"></td>
      <td><input type="text" class="ag-nome" value="${(ag.nome || '').replace(/"/g,'&quot;')}"></td>
      <td><input type="text" class="ag-contato" value="${(ag.contato || '').replace(/"/g,'&quot;')}"></td>
      <td><input type="text" class="ag-cracha" value="${(ag.cracha || '').replace(/"/g,'&quot;')}"></td>
      <td class="admin-table-actions">
        <button type="button" class="admin-btn-salvar-linha">Salvar</button>
        <button type="button" class="admin-btn-excluir-linha">Excluir</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach(row => {
    const id = row.dataset.id;
    const original = agendamentos.find(a => a.id === id); // valores antes de qualquer edição

    row.querySelector('.admin-btn-salvar-linha').addEventListener('click', async () => {
      const dados = {
        servico: row.querySelector('.ag-servico').value.trim(),
        data: row.querySelector('.ag-data').value.trim(),
        horario: row.querySelector('.ag-horario').value.trim(),
        nome: row.querySelector('.ag-nome').value.trim(),
        contato: row.querySelector('.ag-contato').value.trim(),
        cracha: row.querySelector('.ag-cracha').value.trim()
      };
      try{
        await window.fbUpdateDoc(window.fbDoc(window.db, 'agendamentos', id), dados);
        // se mudou serviço/data/horário, libera a vaga antiga e trava a nova
        const mudouHorario = original.servico !== dados.servico || original.data !== dados.data || original.horario !== dados.horario;
        if(mudouHorario){
          await sincronizarVagaEBloqueio(original, dados);
        }
        alert('Agendamento atualizado.');
      }catch(e){
        console.error('Erro ao salvar agendamento:', e);
        alert('Não foi possível salvar. Veja o console para detalhes.');
      }
    });

    row.querySelector('.admin-btn-excluir-linha').addEventListener('click', async () => {
      if(!confirm('Excluir esse agendamento? Isso também libera o horário no calendário. Essa ação não pode ser desfeita.')) return;
      try{
        await window.fbDeleteDoc(window.fbDoc(window.db, 'agendamentos', id));
        await liberarVagaEBloqueio(original);
        row.remove();
        agendamentosCarregados = agendamentosCarregados.filter(a => a.id !== id);
        if(!agendamentosCarregados.length) document.getElementById('btnBaixarPdf').style.display = 'none';
      }catch(e){
        console.error('Erro ao excluir agendamento:', e);
        alert('Não foi possível excluir. Veja o console para detalhes.');
      }
    });
  });
}

// ---- Libera a vaga pública e a trava semanal do sócio referentes a um agendamento ----
async function liberarVagaEBloqueio(ag){
  try{
    // acha e apaga o(s) documento(s) de "vagas" que batem com esse serviço/data/horário
    const q = window.fbQuery(
      window.fbCollection(window.db, 'vagas'),
      window.fbWhere('servico', '==', ag.servico),
      window.fbWhere('data', '==', ag.data),
      window.fbWhere('horario', '==', ag.horario)
    );
    const snap = await window.fbGetDocs(q);
    await Promise.all(snap.docs.map(d => window.fbDeleteDoc(d.ref)));
  }catch(e){
    console.error('Erro ao liberar vaga pública:', e);
  }
  try{
    // se esse agendamento tinha um sócio vinculado, libera só a trava DESSE serviço (os outros continuam livres)
    if(ag.uid){
      const configKey = (ag.servico || '').replace('cal-', ''); // "cal-manicure" -> "manicure"
      const bloqueioRef = window.fbDoc(window.db, 'meus-agendamentos', ag.uid);
      const bloqueioSnap = await window.fbGetDoc(bloqueioRef);
      if(bloqueioSnap.exists()){
        const trava = bloqueioSnap.data()[configKey];
        // só apaga se for a trava referente a ESSE agendamento (evita apagar um agendamento novo por engano)
        if(trava && trava.data === ag.data && trava.horario === ag.horario){
          await window.fbUpdateDoc(bloqueioRef, { [configKey]: null });
        }
      }
    }
  }catch(e){
    console.error('Erro ao liberar trava semanal do sócio:', e);
  }
}

// ---- Quando o admin edita data/horário/serviço, libera o antigo e trava o novo ----
async function sincronizarVagaEBloqueio(original, novo){
  await liberarVagaEBloqueio(original);
  try{
    await window.fbAddDoc(window.fbCollection(window.db, 'vagas'), {
      servico: novo.servico,
      data: novo.data,
      horario: novo.horario,
      uid: original.uid || null,
      criadoEm: window.fbServerTimestamp()
    });
    if(original.uid){
      const configKeyNovo = (novo.servico || '').replace('cal-', '');
      await window.fbSetDoc(window.fbDoc(window.db, 'meus-agendamentos', original.uid), {
        [configKeyNovo]: {
          data: novo.data,
          horario: novo.horario,
          semanaKey: computeWeekStartStr(novo.data)
        }
      }, { merge: true });
    }
  }catch(e){
    console.error('Erro ao travar o novo horário:', e);
  }
}

// =====================================================================
// ABA CONFIG DE DIAS — quais dias da semana cada serviço aceita agendamento
// =====================================================================
const SERVICOS_CONFIG = [
  { key: 'manicure', label: 'Manicure', temNoite: false },
  { key: 'massagem', label: 'Massagem', temNoite: true }
];

async function carregarConfigDias(){
  const grid = document.getElementById('configDiasGrid');
  grid.innerHTML = SERVICOS_CONFIG.map(servico => `
    <div class="admin-config-card" data-servico="${servico.key}">
      <h4>${servico.label}</h4>
      <p class="admin-field-hint">Dias com atendimento:</p>
      <div class="admin-config-dias">
        ${DIAS_SEMANA.map((nome, idx) => `
          <label class="admin-checkbox-pill">
            <input type="checkbox" class="dia-checkbox" value="${idx}">
            <span>${nome.slice(0,3)}</span>
          </label>
        `).join('')}
      </div>
      ${servico.temNoite ? `
        <p class="admin-field-hint" style="margin-top:14px;">Dia com horário de noite (19h-21h):</p>
        <div class="admin-config-dias">
          <label class="admin-checkbox-pill">
            <input type="radio" name="dia-noite-${servico.key}" class="dia-noite-radio" value="">
            <span>Nenhum</span>
          </label>
          ${DIAS_SEMANA.map((nome, idx) => `
            <label class="admin-checkbox-pill">
              <input type="radio" name="dia-noite-${servico.key}" class="dia-noite-radio" value="${idx}">
              <span>${nome.slice(0,3)}</span>
            </label>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  for(const servico of SERVICOS_CONFIG){
    try{
      const snap = await window.fbGetDoc(window.fbDoc(window.db, 'config', servico.key));
      const dados = snap.exists() ? snap.data() : {};
      const dias = Array.isArray(dados.openWeekdays) ? dados.openWeekdays : [];
      const card = grid.querySelector(`[data-servico="${servico.key}"]`);
      dias.forEach(d => {
        const cb = card.querySelector(`.dia-checkbox[value="${d}"]`);
        if(cb) cb.checked = true;
      });
      if(servico.temNoite){
        const valorNoite = ('diaNoite' in dados && dados.diaNoite !== null) ? String(dados.diaNoite) : '';
        const radio = card.querySelector(`.dia-noite-radio[value="${valorNoite}"]`);
        if(radio) radio.checked = true;
      }
    }catch(e){
      console.error(`Erro ao carregar config de ${servico.key}:`, e);
    }
  }
}

document.getElementById('btnSalvarConfig').addEventListener('click', async () => {
  const msg = document.getElementById('configSaveMsg');
  msg.textContent = 'Salvando...';
  try{
    for(const servico of SERVICOS_CONFIG){
      const card = document.querySelector(`.admin-config-card[data-servico="${servico.key}"]`);
      const dias = Array.from(card.querySelectorAll('.dia-checkbox:checked')).map(cb => parseInt(cb.value, 10));
      const payload = { openWeekdays: dias };
      if(servico.temNoite){
        const radioMarcado = card.querySelector('.dia-noite-radio:checked');
        payload.diaNoite = (radioMarcado && radioMarcado.value !== '') ? parseInt(radioMarcado.value, 10) : null;
      }
      await window.fbSetDoc(window.fbDoc(window.db, 'config', servico.key), payload);
    }
    msg.textContent = 'Salvo! O site já reflete as mudanças em tempo real.';
  }catch(e){
    console.error('Erro ao salvar config de dias:', e);
    msg.textContent = 'Não foi possível salvar. Veja o console para detalhes.';
  }
});

// =====================================================================
// ABA SÓCIOS CADASTRADOS — lista, e permite excluir o perfil (Firestore)
// =====================================================================
document.getElementById('btnCarregarSocios').addEventListener('click', async () => {
  const btn = document.getElementById('btnCarregarSocios');
  btn.disabled = true;
  btn.textContent = 'Carregando...';
  try{
    const snap = await window.fbGetDocs(window.fbCollection(window.db, 'socios'));
    const socios = [];
    snap.forEach(d => socios.push(Object.assign({ uid: d.id }, d.data())));
    socios.sort((a, b) => (a.cracha || '').localeCompare(b.cracha || ''));
    renderSociosTable(socios);
  }catch(e){
    console.error('Erro ao carregar sócios:', e);
    alert('Não foi possível carregar os sócios. Veja o console para detalhes.');
  }
  btn.disabled = false;
  btn.textContent = 'Carregar';
});

function renderSociosTable(socios){
  const table = document.getElementById('sociosTable');
  const tbody = document.getElementById('sociosTableBody');
  const vazio = document.getElementById('sociosVazio');

  if(!socios.length){
    table.style.display = 'none';
    vazio.style.display = '';
    vazio.textContent = 'Nenhum sócio cadastrado ainda.';
    return;
  }
  vazio.style.display = 'none';
  table.style.display = '';

  tbody.innerHTML = socios.map(s => `
    <tr data-uid="${s.uid}">
      <td>${(s.cracha || '—')}</td>
      <td>${(s.nome || '—')}</td>
      <td>${(s.cracha || '')}@socios.gremio-miracema.local</td>
      <td class="admin-table-actions">
        <button type="button" class="admin-btn-excluir-linha">Excluir perfil</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach(row => {
    const uid = row.dataset.uid;
    row.querySelector('.admin-btn-excluir-linha').addEventListener('click', async () => {
      if(!confirm('Excluir o perfil desse sócio (nome e crachá salvos)? Isso NÃO apaga a conta de login — veja o aviso no topo da página sobre isso.')) return;
      try{
        await window.fbDeleteDoc(window.fbDoc(window.db, 'socios', uid));
        await window.fbDeleteDoc(window.fbDoc(window.db, 'meus-agendamentos', uid)).catch(() => {}); // limpa a trava também, se existir
        row.remove();
      }catch(e){
        console.error('Erro ao excluir perfil do sócio:', e);
        alert('Não foi possível excluir. Veja o console para detalhes.');
      }
    });
  });
}
