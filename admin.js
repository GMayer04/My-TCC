// =====================================================================
// PAINEL ADMIN — login, CRUD de eventos, relatório de agendamentos, config de dias
// =====================================================================

const DIAS_SEMANA = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

// ---- Proteção contra XSS: qualquer texto vindo de sócios (nome, contato, crachá, etc)
// precisa passar por aqui antes de ir pro innerHTML, senão alguém pode se cadastrar
// com um nome tipo "<img src=x onerror=...>" e rodar código dentro da sessão do admin.
function escapeHtml(valor){
  const div = document.createElement('div');
  div.textContent = valor === undefined || valor === null ? '' : String(valor);
  return div.innerHTML;
}
// ---- Mesma ideia, mas pra usar dentro de atributos value="..." (mantém aspas seguras) ----
function escapeAttr(valor){
  return escapeHtml(valor).replace(/"/g, '&quot;');
}

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
function nomeServico(s){
  return s === 'cal-manicure' ? 'Manicure' : (s === 'cal-massage' ? 'Massagem' : (s || 'Serviço'));
}
// ---- Converte o ID técnico do serviço ("cal-manicure"/"cal-massage") pra chave usada na trava
// semanal ("manicure"/"massagem" — igual ao configKey do script.js). NÃO é um simples "tira o cal-":
// "cal-massage" não vira "massagem" só cortando prefixo, por isso existe esse mapeamento explícito.
function containerIdParaConfigKey(servico){
  if(servico === 'cal-manicure') return 'manicure';
  if(servico === 'cal-massage') return 'massagem';
  return (servico || '').replace('cal-', '');
}
function dataFormatadaBr(d){
  return d ? d.split('-').reverse().join('/') : '';
}
function nomeDiaSemana(dateStr){
  const dias = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
  return dias[new Date(dateStr + 'T00:00:00').getDay()];
}
// ---- Agrupa uma lista de agendamentos em { servico: { data: [agendamentos ordenados por horário] } } ----
function agruparPorDataEServico(agendamentos){
  const grupos = {};
  agendamentos.forEach(ag => {
    const servico = ag.servico || 'outro';
    const data = ag.data || 'sem-data';
    if(!grupos[data]) grupos[data] = {};
    if(!grupos[data][servico]) grupos[data][servico] = [];
    grupos[data][servico].push(ag);
  });
  Object.values(grupos).forEach(porServico => {
    Object.values(porServico).forEach(lista => lista.sort((a, b) => (a.horario || '').localeCompare(b.horario || '')));
  });
  return grupos;
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
  info.innerHTML = `${escapeHtml(email)} · <a href="#" id="adminLogoutLink">Sair</a>`;
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
    <div class="admin-event-row" data-id="${escapeAttr(ev.id)}">
      <div class="admin-event-thumb-wrap">
        <img src="${escapeAttr(ev.imgData || ev.img || '')}" alt="" class="admin-event-thumb admin-event-preview" onerror="this.style.opacity=0.2">
      </div>
      <div class="admin-event-fields">
        <label class="field-label">Título</label>
        <input type="text" class="ev-titulo" value="${escapeAttr(ev.title)}" placeholder="Título do evento">

        <label class="field-label">Imagem (escolha um arquivo do computador)</label>
        <input type="file" class="ev-imagem-arquivo" accept="image/*">
        <p class="admin-field-hint">Ou, se preferir, cole o caminho/link de uma imagem já existente:</p>
        <input type="text" class="ev-imagem" value="${escapeAttr(ev.img)}" placeholder="images/evento.png ou https://...">

        <label class="field-label">Data / horário / local</label>
        <input type="text" class="ev-datahora" value="${escapeAttr(ev.time)}" placeholder="Ex: 02 AGO · 19h — Salão Social">

        <label class="field-label">Descrição</label>
        <textarea class="ev-descricao" rows="2" placeholder="Descrição do evento">${escapeHtml(ev.description)}</textarea>

        <label class="field-label">Link (opcional)</label>
        <input type="text" class="ev-link" value="${escapeAttr(ev.link)}" placeholder="https://...">
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
    preencherSeletorDeDia(agendamentos);
    document.getElementById('btnBaixarPdf').style.display = agendamentos.length ? '' : 'none';
    document.getElementById('pdfDiaSelect').style.display = agendamentos.length ? '' : 'none';
  }catch(e){
    console.error('Erro ao carregar agendamentos:', e);
    alert('Não foi possível carregar os agendamentos. Veja o console para detalhes.');
  }
  btn.disabled = false;
  btn.textContent = 'Carregar';
});

function preencherSeletorDeDia(agendamentos){
  const select = document.getElementById('pdfDiaSelect');
  const datasUnicas = [...new Set(agendamentos.map(ag => ag.data).filter(Boolean))].sort();
  select.innerHTML = '<option value="todos">Todos os dias</option>' + datasUnicas.map(data =>
    `<option value="${escapeAttr(data)}">${escapeHtml(dataFormatadaBr(data))} · ${escapeHtml(nomeDiaSemana(data))}</option>`
  ).join('');
}

document.getElementById('btnBaixarPdf').addEventListener('click', () => {
  if(!agendamentosCarregados.length) return;
  const diaEscolhido = document.getElementById('pdfDiaSelect').value;
  const dadosFiltrados = diaEscolhido === 'todos'
    ? agendamentosCarregados
    : agendamentosCarregados.filter(ag => ag.data === diaEscolhido);

  if(!dadosFiltrados.length){
    alert('Não há agendamentos para o dia selecionado.');
    return;
  }

  const { inicio, fim } = getSemanaAtual();
  const subtitulo = diaEscolhido === 'todos'
    ? `Relatório de agendamentos — semana de ${dataFormatadaBr(inicio)} a ${dataFormatadaBr(fim)}`
    : `Relatório de agendamentos — ${dataFormatadaBr(diaEscolhido)} · ${nomeDiaSemana(diaEscolhido)}`;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Grêmio Social Recreativo Miracema', 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(subtitulo, 14, 26);
  doc.setTextColor(0);

  const grupos = agruparPorDataEServico(dadosFiltrados);
  const datasOrdenadas = Object.keys(grupos).sort();

  let y = 36;
  const margemPagina = doc.internal.pageSize.getHeight() - 20;

  datasOrdenadas.forEach(data => {
    if(y > margemPagina - 14){ doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setTextColor(18, 148, 106);
    doc.text(`${dataFormatadaBr(data)} · ${nomeDiaSemana(data)}`, 14, y);
    doc.setTextColor(0);
    y += 6;

    const servicosOrdenados = Object.keys(grupos[data]).sort((a, b) => nomeServico(a).localeCompare(nomeServico(b)));
    servicosOrdenados.forEach(servico => {
      if(y > margemPagina - 10){ doc.addPage(); y = 20; }
      doc.setFontSize(10.5);
      doc.setTextColor(90);
      doc.text(nomeServico(servico), 14, y);
      doc.setTextColor(0);
      y += 3;

      doc.autoTable({
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Horário', 'Nome', 'Contato', 'Crachá']],
        body: grupos[data][servico].map(ag => [ag.horario || '', ag.nome || '', ag.contato || '', ag.cracha || '']),
        headStyles: { fillColor: [18, 148, 106] },
        styles: { fontSize: 9, cellPadding: 4 },
        alternateRowStyles: { fillColor: [244, 248, 246] }
      });
      y = doc.lastAutoTable.finalY + 10;
    });
  });

  const nomeArquivo = diaEscolhido === 'todos' ? `agendamentos_${inicio}_a_${fim}.pdf` : `agendamentos_${diaEscolhido}.pdf`;
  doc.save(nomeArquivo);
});

function renderAgendamentosTable(agendamentos){
  const container = document.getElementById('agendamentosGrouped');
  const vazio = document.getElementById('agendamentosVazio');

  if(!agendamentos.length){
    container.innerHTML = '';
    vazio.style.display = '';
    vazio.textContent = 'Nenhum agendamento encontrado para a semana atual.';
    return;
  }
  vazio.style.display = 'none';

  const grupos = agruparPorDataEServico(agendamentos);
  const datasOrdenadas = Object.keys(grupos).sort();

  container.innerHTML = datasOrdenadas.map(data => {
    const servicosOrdenados = Object.keys(grupos[data]).sort((a, b) => nomeServico(a).localeCompare(nomeServico(b)));
    const blocosServico = servicosOrdenados.map(servico => {
      const lista = grupos[data][servico];
      const linhas = lista.map(ag => `
        <tr data-id="${escapeAttr(ag.id)}">
          <td style="width:110px"><input type="text" class="ag-servico" value="${escapeAttr(ag.servico)}" title="Serviço (ID técnico)"></td>
          <td style="width:100px"><input type="text" class="ag-data" value="${escapeAttr(ag.data)}" title="Data (AAAA-MM-DD)"></td>
          <td style="width:80px"><input type="text" class="ag-horario" value="${escapeAttr(ag.horario)}"></td>
          <td><input type="text" class="ag-nome" value="${escapeAttr(ag.nome)}"></td>
          <td><input type="text" class="ag-contato" value="${escapeAttr(ag.contato)}"></td>
          <td style="width:80px"><input type="text" class="ag-cracha" value="${escapeAttr(ag.cracha)}"></td>
          <td class="admin-table-actions">
            <button type="button" class="admin-btn-salvar-linha">Salvar</button>
            <button type="button" class="admin-btn-excluir-linha">Excluir</button>
          </td>
        </tr>`).join('');
      return `
        <div class="admin-agenda-servico-sub-bloco">
          <h4 class="admin-agenda-servico-sub-titulo">${escapeHtml(nomeServico(servico))}</h4>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th style="width:110px">Serviço</th><th style="width:100px">Data</th><th style="width:80px">Horário</th><th>Nome</th><th>Contato</th><th style="width:80px">Crachá</th><th></th></tr></thead>
              <tbody>${linhas}</tbody>
            </table>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="admin-agenda-data-bloco">
        <h3 class="admin-agenda-data-titulo">${escapeHtml(dataFormatadaBr(data))} <span>· ${escapeHtml(nomeDiaSemana(data))}</span></h3>
        ${blocosServico}
      </div>`;
  }).join('');

  container.querySelectorAll('tbody tr').forEach(row => {
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
        agendamentosCarregados = agendamentosCarregados.filter(a => a.id !== id);
        renderAgendamentosTable(agendamentosCarregados);
        preencherSeletorDeDia(agendamentosCarregados);
        if(!agendamentosCarregados.length){
          document.getElementById('btnBaixarPdf').style.display = 'none';
          document.getElementById('pdfDiaSelect').style.display = 'none';
        }
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
      const configKey = containerIdParaConfigKey(ag.servico);
      const bloqueioRef = window.fbDoc(window.db, 'meus-agendamentos', ag.uid);
      const bloqueioSnap = await window.fbGetDoc(bloqueioRef);
      if(bloqueioSnap.exists()){
        const dadosAtuais = bloqueioSnap.data();
        const trava = dadosAtuais[configKey];
        // só mexe se for a trava referente a ESSE agendamento (evita apagar um agendamento novo por engano)
        if(trava && trava.data === ag.data && trava.horario === ag.horario){
          const outrasChaves = Object.keys(dadosAtuais).filter(k => k !== configKey);
          if(outrasChaves.length === 0){
            // não sobra trava de nenhum outro serviço: apaga o documento inteiro, não deixa ele vazio
            await window.fbDeleteDoc(bloqueioRef);
          } else {
            await window.fbUpdateDoc(bloqueioRef, { [configKey]: window.fbDeleteField() });
          }
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
      const configKeyNovo = containerIdParaConfigKey(novo.servico);
      const semanaKeyNovo = computeWeekStartStr(novo.data);
      const duracaoSemanas = configKeyNovo === 'manicure' ? 2 : 1; // manicure: semana agendada + a seguinte
      const liberaEmDate = new Date(semanaKeyNovo + 'T00:00:00');
      liberaEmDate.setDate(liberaEmDate.getDate() + 7 * duracaoSemanas);
      await window.fbSetDoc(window.fbDoc(window.db, 'meus-agendamentos', original.uid), {
        [configKeyNovo]: {
          data: novo.data,
          horario: novo.horario,
          semanaKey: semanaKeyNovo,
          liberaEm: formatDateStr(liberaEmDate)
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
      <p class="admin-field-hint" style="margin-top:14px;">Bloquear novos agendamentos até (opcional):</p>
      <input type="date" class="config-bloqueado-ate" style="max-width:180px;">
      <button type="button" class="admin-btn-secundario config-limpar-bloqueio" style="padding:6px 12px; font-size:12px; margin-left:8px;">Remover bloqueio</button>
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
      const inputBloqueio = card.querySelector('.config-bloqueado-ate');
      if(dados.bloqueadoAte) inputBloqueio.value = dados.bloqueadoAte;
      card.querySelector('.config-limpar-bloqueio').addEventListener('click', () => {
        inputBloqueio.value = '';
      });
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
      const valorBloqueio = card.querySelector('.config-bloqueado-ate').value;
      payload.bloqueadoAte = valorBloqueio || null;
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
    <tr data-uid="${escapeAttr(s.uid)}">
      <td>${escapeHtml(s.cracha || '—')}</td>
      <td>${escapeHtml(s.nome || '—')}</td>
      <td>${escapeHtml(s.cracha || '')}@socios.gremio-miracema.local</td>
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

// =====================================================================
// ABA MANUTENÇÃO — apaga agendamentos/vagas antigos em lote
// =====================================================================
document.getElementById('btnLimparAntigos').addEventListener('click', async () => {
  const dias = parseInt(document.querySelector('input[name="dias-corte"]:checked').value, 10);
  const msg = document.getElementById('limpezaMsg');

  const corte = todayDateOnly();
  corte.setDate(corte.getDate() - dias);
  const corteStr = formatDateStr(corte);

  if(!confirm(`Apagar TODOS os agendamentos e vagas com data anterior a ${corteStr.split('-').reverse().join('/')}? Essa ação não pode ser desfeita.`)) return;

  const btn = document.getElementById('btnLimparAntigos');
  btn.disabled = true;
  btn.textContent = 'Apagando...';
  msg.textContent = '';

  try{
    // apaga de "agendamentos"
    const qAgendamentos = window.fbQuery(
      window.fbCollection(window.db, 'agendamentos'),
      window.fbWhere('data', '<', corteStr)
    );
    const snapAgendamentos = await window.fbGetDocs(qAgendamentos);
    await Promise.all(snapAgendamentos.docs.map(d => window.fbDeleteDoc(d.ref)));

    // apaga de "vagas"
    const qVagas = window.fbQuery(
      window.fbCollection(window.db, 'vagas'),
      window.fbWhere('data', '<', corteStr)
    );
    const snapVagas = await window.fbGetDocs(qVagas);
    await Promise.all(snapVagas.docs.map(d => window.fbDeleteDoc(d.ref)));

    const total = snapAgendamentos.size + snapVagas.size;
    msg.style.color = 'var(--green-deep)';
    msg.textContent = `Pronto! ${total} registro(s) apagado(s) (${snapAgendamentos.size} agendamento(s), ${snapVagas.size} vaga(s)).`;
  }catch(e){
    console.error('Erro ao limpar registros antigos:', e);
    msg.style.color = '#C0392B';
    msg.textContent = 'Não foi possível apagar. Veja o console para detalhes.';
  }

  btn.disabled = false;
  btn.textContent = 'Apagar registros antigos';
});
