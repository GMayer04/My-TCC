// ============================================================
// UTILITÁRIOS
// ============================================================
function escapeHtml(valor){
  const div = document.createElement('div');
  div.textContent = valor === undefined || valor === null ? '' : String(valor);
  return div.innerHTML;
}
function escapeAttr(valor){
  return escapeHtml(valor).replace(/"/g, '&quot;');
}

// ============================================================
// NAVEGAÇÃO MOBILE
// ============================================================
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  navToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open);
  });

  // ============================================================
  // LOGIN DE SÓCIOS (CRACHÁ + PIN)
  // ============================================================
  window.socioAtual = null;

  function montarEmailSintetico(cracha){
    return `${cracha}@socios.gremio-miracema.local`;
  }
  function montarSenhaFirebase(pin){
    return pin;
  }

  // Limite de PIN: freio de uso (localStorage), não é proteção real. O bloqueio real vem do Firebase Auth e do App Check.
  const TENTATIVAS_KEY = 'miracema-tentativas-pin';
  const MAX_TENTATIVAS_PIN = 5;
  const MINUTOS_BLOQUEIO = [5, 15, 60];

  function lerTentativas(){
    try{ return JSON.parse(localStorage.getItem(TENTATIVAS_KEY)) || {}; }
    catch(e){ return {}; }
  }
  function salvarTentativas(obj){
    try{ localStorage.setItem(TENTATIVAS_KEY, JSON.stringify(obj)); }
    catch(e){ /* sem localStorage disponível: segue sem o limite local */ }
  }
  function minutosRestantesDeBloqueio(cracha){
    const reg = lerTentativas()[cracha];
    if(!reg || !reg.bloqueadoAte) return 0;
    const restanteMs = reg.bloqueadoAte - Date.now();
    return restanteMs > 0 ? Math.ceil(restanteMs / 60000) : 0;
  }
  function registrarFalhaPin(cracha){
    const todas = lerTentativas();
    const reg = todas[cracha] || { falhas: 0, bloqueios: 0, bloqueadoAte: 0 };
    reg.falhas += 1;
    if(reg.falhas >= MAX_TENTATIVAS_PIN){
      const minutos = MINUTOS_BLOQUEIO[Math.min(reg.bloqueios, MINUTOS_BLOQUEIO.length - 1)];
      reg.bloqueadoAte = Date.now() + minutos * 60000;
      reg.bloqueios += 1;
      reg.falhas = 0;
    }
    todas[cracha] = reg;
    salvarTentativas(todas);
    return reg;
  }
  function limparFalhasPin(cracha){
    const todas = lerTentativas();
    delete todas[cracha];
    salvarTentativas(todas);
  }

  async function tentarLoginOuCadastro(cracha, pin, nome){
    const email = montarEmailSintetico(cracha);
    const senha = montarSenhaFirebase(pin);
    const MSG_MUITAS_REQUISICOES = 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';

    const minutosBloqueado = minutosRestantesDeBloqueio(cracha);
    if(minutosBloqueado > 0){
      throw new Error(`Muitas tentativas incorretas para este crachá. Tente de novo em ${minutosBloqueado} min.`);
    }

    try{
      await window.fbSignIn(window.auth, email, senha);
      limparFalhasPin(cracha);
    }catch(errLogin){
      if(errLogin.code === 'auth/too-many-requests') throw new Error(MSG_MUITAS_REQUISICOES);

      try{
        const cred = await window.fbCreateUser(window.auth, email, senha);
        await window.fbSetDoc(window.fbDoc(window.db, 'socios', cred.user.uid), {
          cracha,
          nome: nome || '',
          criadoEm: window.fbServerTimestamp()
        });
        limparFalhasPin(cracha);
      }catch(errCadastro){
        if(errCadastro.code === 'auth/too-many-requests') throw new Error(MSG_MUITAS_REQUISICOES);
        if(errCadastro.code === 'auth/email-already-in-use'){
          const reg = registrarFalhaPin(cracha);
          const minutos = minutosRestantesDeBloqueio(cracha);
          if(minutos > 0){
            throw new Error(`PIN incorreto. Crachá bloqueado por ${minutos} min por excesso de tentativas.`);
          }
          const restantes = MAX_TENTATIVAS_PIN - reg.falhas;
          throw new Error(`PIN incorreto. Você tem mais ${restantes} tentativa${restantes === 1 ? '' : 's'} antes do bloqueio temporário.`);
        }
        console.error('Erro no login/cadastro de sócio:', errCadastro);
        throw new Error('Não foi possível entrar. Confira o crachá e o PIN e tente de novo.');
      }
    }
  }

  function mostrarAreaLogada(nome){
    document.getElementById('socioLoginGate').style.display = 'none';
    document.getElementById('servicesGrid').style.display = '';
    const info = document.getElementById('socioLoggedInfo');
    info.style.display = '';
    info.innerHTML = `Logado como <strong>${escapeHtml(nome || 'sócio')}</strong> · <a href="#" id="socioLogoutLink">Sair</a>`;
    document.getElementById('socioLogoutLink').addEventListener('click', (e) => {
      e.preventDefault();
      window.fbSignOut(window.auth);
    });
  }

  function mostrarAreaLogin(){
    document.getElementById('socioLoginGate').style.display = '';
    document.getElementById('servicesGrid').style.display = 'none';
    document.getElementById('socioLoggedInfo').style.display = 'none';
  }

  function iniciarAuthListener(){
    if(!window.auth){
      setTimeout(iniciarAuthListener, 200);
      return;
    }
    window.fbOnAuthStateChanged(window.auth, async (user) => {
      if(user){
        let perfil = { cracha: '', nome: '' };
        try{
          const snap = await window.fbGetDoc(window.fbDoc(window.db, 'socios', user.uid));
          if(snap.exists()) perfil = snap.data();
        }catch(e){
          console.error('Erro ao buscar perfil do sócio:', e);
        }
        window.socioAtual = { uid: user.uid, cracha: perfil.cracha, nome: perfil.nome };
        mostrarAreaLogada(perfil.nome);
        iniciarEscutaMeuAgendamento(user.uid);
      } else {
        window.socioAtual = null;
        mostrarAreaLogin();
        iniciarEscutaMeuAgendamento(null);
      }
    });
  }
  iniciarAuthListener();

  // Máscara e validação do formulário
  document.getElementById('loginCracha').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });
  document.getElementById('loginPin').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });
  document.getElementById('socioLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cracha = document.getElementById('loginCracha').value.trim();
    const pin = document.getElementById('loginPin').value.trim();
    const nome = document.getElementById('loginNome').value.trim();
    const errorEl = document.getElementById('loginFormError');
    const btn = document.getElementById('loginSubmitBtn');
    errorEl.textContent = '';

    if(cracha.length !== 4 || pin.length !== 6){
      errorEl.textContent = 'Preencha o crachá com 4 dígitos e o PIN com 6 dígitos.';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Entrando...';
    try{
      await tentarLoginOuCadastro(cracha, pin, nome);
    }catch(err){
      errorEl.textContent = err.message || 'Não foi possível entrar.';
    }
    btn.disabled = false;
    btn.textContent = 'Entrar';
  });

  // ============================================================
  // MODAIS DE ASSOCIAÇÃO
  // ============================================================
  function ensureSocioModal(){
    if(document.getElementById('socioModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'socioModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box socio-modal-box" role="dialog" aria-modal="true" aria-labelledby="socioModalTitle">
        <button type="button" class="modal-close socio-modal-close" id="socioModalClose" aria-label="Fechar">&times;</button>
        <h3 id="socioModalTitle">Sobre o Grêmio Recreativo</h3>
        <p class="socio-modal-text">O Grêmio Recreativo é uma iniciativa voltada à promoção do bem-estar, da integração e da qualidade de vida dos colaboradores associados, proporcionando momentos de lazer, confraternização e experiências ao longo de todo o ano.</p>
        <p class="socio-modal-text">Por meio da associação, os colaboradores têm acesso a uma programação diversificada de ações e benefícios, especialmente em datas comemorativas. Entre as iniciativas estão as tradicionais celebrações de Dia das Mães, Dia dos Pais e Natal, além da distribuição de ovos de Páscoa e outras ações especiais desenvolvidas para valorizar os associados e suas famílias.</p>
        <p class="socio-modal-text">Além das atividades comemorativas, o Grêmio oferece serviços e ações voltados ao cuidado e ao bem-estar durante a rotina, como massagens e serviços de manicure, proporcionando momentos de relaxamento e cuidado pessoal aos colaboradores.</p>
        <p class="socio-modal-text">A integração também é incentivada por meio de eventos esportivos, campeonatos internos e atividades de confraternização, criando oportunidades para que os associados compartilhem experiências, fortaleçam vínculos e promovam um ambiente cada vez mais colaborativo.</p>
        <p class="socio-modal-text">Mais do que oferecer benefícios, o Grêmio Recreativo busca aproximar pessoas, incentivar a convivência e proporcionar momentos especiais, contribuindo para uma experiência mais positiva e integrada dentro e fora do ambiente de trabalho.</p>
        <p class="socio-modal-text">Faça parte do Grêmio Recreativo e aproveite tudo o que preparamos para você.</p>
        <button type="button" class="socio-modal-btn" id="abrirFormularioSocioBtn">Quero me associar</button>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) closeSocioModal();
    });
    document.getElementById('socioModalClose').addEventListener('click', closeSocioModal);
    document.getElementById('abrirFormularioSocioBtn').addEventListener('click', () => {
      closeSocioModal();
      openSolicitacaoModal();
    });
  }

  function ensureSolicitacaoModal(){
    if(document.getElementById('solicitacaoModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'solicitacaoModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="solicitacaoModalTitle">
        <button type="button" class="modal-close" id="solicitacaoModalClose" aria-label="Fechar">&times;</button>
        <h3 id="solicitacaoModalTitle">Quero me associar</h3>
        <p class="modal-subtitle">Preencha seus dados e a recepção do Grêmio entra em contato com você.</p>
        <form id="solicitacaoForm" novalidate>
          <label class="field-label" for="solicitacaoNome">Nome completo</label>
          <input type="text" id="solicitacaoNome" required autocomplete="name" placeholder="Seu nome">

          <label class="field-label" for="solicitacaoContato">Telefone / WhatsApp</label>
          <input type="tel" id="solicitacaoContato" required autocomplete="tel" placeholder="(19) 99999-9999">

          <label class="field-label" for="solicitacaoSetor">Setor / área (opcional)</label>
          <input type="text" id="solicitacaoSetor" placeholder="Ex: Manutenção, Financeiro...">

          <p class="form-error" id="solicitacaoFormError"></p>
          <button type="submit" class="book-btn" id="solicitacaoSubmitBtn">Enviar solicitação</button>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) closeSolicitacaoModal();
    });
    document.getElementById('solicitacaoModalClose').addEventListener('click', closeSolicitacaoModal);
    document.getElementById('solicitacaoContato').addEventListener('input', (e) => {
      let numeros = e.target.value.replace(/\D/g, '').slice(0, 11);
      let formatado = numeros;
      if(numeros.length > 0) formatado = '(' + numeros.slice(0, 2);
      if(numeros.length >= 3) formatado += ') ' + numeros.slice(2, 7);
      if(numeros.length >= 8) formatado += '-' + numeros.slice(7, 11);
      e.target.value = formatado;
    });

    document.getElementById('solicitacaoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = document.getElementById('solicitacaoNome').value.trim();
      const contato = document.getElementById('solicitacaoContato').value.trim();
      const setor = document.getElementById('solicitacaoSetor').value.trim();
      const errorEl = document.getElementById('solicitacaoFormError');
      const btn = document.getElementById('solicitacaoSubmitBtn');
      errorEl.textContent = '';

      if(!nome || !contato){
        errorEl.textContent = 'Preencha nome e telefone/WhatsApp para continuar.';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      try{
        await window.fbAddDoc(window.fbCollection(window.db, 'solicitacoes-socio'), {
          nome, contato, setor,
          status: 'pendente',
          criadoEm: window.fbServerTimestamp()
        });
        closeSolicitacaoModal();
        showSuccessToast('Solicitação enviada! A recepção do Grêmio vai entrar em contato.');
      }catch(err){
        console.error('Erro ao enviar solicitação de associação:', err);
        errorEl.textContent = 'Não foi possível enviar. Tente novamente.';
      }
      btn.disabled = false;
      btn.textContent = 'Enviar solicitação';
    });
  }

  function openSolicitacaoModal(){
    ensureSolicitacaoModal();
    const overlay = document.getElementById('solicitacaoModalOverlay');
    document.getElementById('solicitacaoForm').reset();
    document.getElementById('solicitacaoFormError').textContent = '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSolicitacaoModal(){
    const overlay = document.getElementById('solicitacaoModalOverlay');
    if(overlay){
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function openSocioModal(){
    ensureSocioModal();
    const overlay = document.getElementById('socioModalOverlay');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSocioModal(){
    const overlay = document.getElementById('socioModalOverlay');
    if(overlay){
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  const queroSerSocioBtn = document.getElementById('quero-ser-socio-btn');
  if(queroSerSocioBtn){
    queroSerSocioBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openSocioModal();
    });
  }

  // ============================================================
  // TICKER DE EVENTOS
  // ============================================================
  const track = document.getElementById('tickerTrack');

  function parseEventDateAndDetail(timeStr){
    const dotIndex = timeStr.indexOf('·');
    const dashIndex = timeStr.indexOf('—');
    let cutIndex = -1;
    if(dotIndex !== -1 && (dashIndex === -1 || dotIndex < dashIndex)) cutIndex = dotIndex;
    else if(dashIndex !== -1) cutIndex = dashIndex;
    if(cutIndex === -1) return { date: timeStr.trim(), detail: '' };
    return {
      date: timeStr.slice(0, cutIndex).trim(),
      detail: timeStr.slice(cutIndex + 1).trim()
    };
  }

  function renderTicker(){
    if(!eventCards.length){
      track.innerHTML = '';
      return;
    }
    const itemHtml = eventCards.map(ev => {
      const { date, detail } = parseEventDateAndDetail(ev.time);
      return `
        <div class="ticker-item">
          <span class="date-chip">${escapeHtml(date)}</span>
          <span><strong>${escapeHtml(ev.title)}</strong>${detail ? ' — ' + escapeHtml(detail) : ''}</span>
        </div>`;
    }).join('');
    const vezes = Math.max(2, Math.ceil(6 / eventCards.length));
    track.innerHTML = itemHtml.repeat(vezes);
  }

  // ============================================================
  // AGENDAMENTOS (FIRESTORE)
  // ============================================================
  let bookingsCache = {};
  const calendarRenderers = [];

  // Trava por sócio e por serviço (meus-agendamentos)
  let meuAgendamentoCache = {};
  let unsubscribeMeuAgendamento = null;

  function computeWeekStartStr(dateStr){
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - d.getDay());
    return formatDateStr(d);
  }

  // Duração da trava: manicure 2 semanas, demais 1
  function getDuracaoBloqueioSemanas(configKey){
    return configKey === 'manicure' ? 2 : 1;
  }

  function iniciarEscutaMeuAgendamento(uid){
    if(unsubscribeMeuAgendamento){ unsubscribeMeuAgendamento(); unsubscribeMeuAgendamento = null; }
    if(!uid){
      meuAgendamentoCache = {};
      calendarRenderers.forEach(fn => fn());
      return;
    }
    const ref = window.fbDoc(window.db, 'meus-agendamentos', uid);
    unsubscribeMeuAgendamento = window.fbOnSnapshot(ref, (snap) => {
      meuAgendamentoCache = snap.exists() ? snap.data() : {};
      calendarRenderers.forEach(fn => fn());
    });
  }

  function getMeuAgendamento(configKey){
    const info = meuAgendamentoCache ? meuAgendamentoCache[configKey] : null;
    if(!info) return null;
    const semanaAtual = computeWeekStartStr(formatDateStr(todayDateOnly()));
    const limite = info.liberaEm || info.semanaKey;
    return (semanaAtual < limite) ? info : null;
  }

  async function setMeuAgendamento(configKey, info){
    if(!window.socioAtual) return;
    const semanaKey = computeWeekStartStr(info.data);
    const duracaoSemanas = getDuracaoBloqueioSemanas(configKey);
    const liberaEmDate = new Date(semanaKey + 'T00:00:00');
    liberaEmDate.setDate(liberaEmDate.getDate() + 7 * duracaoSemanas);
    const liberaEm = formatDateStr(liberaEmDate);
    const completo = Object.assign({}, info, { semanaKey, liberaEm });
    await window.fbSetDoc(window.fbDoc(window.db, 'meus-agendamentos', window.socioAtual.uid), { [configKey]: completo }, { merge: true });
  }

  function loadBookings(){
    return bookingsCache;
  }

  async function saveBooking(containerId, dateStr, time, dados){
    const criadoEm = window.fbServerTimestamp();
    const uid = window.socioAtual ? window.socioAtual.uid : null;
    // Validado pelas Rules contra request.time (bloqueia agendamento retroativo)
    const timestampAgendamento = window.fbTimestamp.fromDate(new Date(`${dateStr}T${time}:00`));
    // ID serviço__data__horário: a transação detecta conflito
    const vagaId = `${containerId}__${dateStr}__${time.replace(':', '')}`;
    const vagaRef = window.fbDoc(window.db, 'vagas', vagaId);
    const agendamentoRef = window.fbDoc(window.fbCollection(window.db, 'agendamentos'));

    await window.fbRunTransaction(window.db, async (transaction) => {
      const vagaSnap = await transaction.get(vagaRef);
      if(vagaSnap.exists()){
        throw new Error('Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.');
      }
      transaction.set(vagaRef, {
        servico: containerId,
        data: dateStr,
        horario: time,
        uid,
        timestampAgendamento,
        criadoEm
      });
      transaction.set(agendamentoRef, {
        servico: containerId,
        data: dateStr,
        horario: time,
        nome: dados.nome,
        contato: dados.contato,
        cracha: dados.cracha,
        aceitouTermo: true,
        uid,
        timestampAgendamento,
        criadoEm
      });
    });
  }

  function iniciarEscutaAgendamentos(){
    if(!window.db){
      setTimeout(iniciarEscutaAgendamentos, 200);
      return;
    }
    const ref = window.fbCollection(window.db, 'vagas');
    window.fbOnSnapshot(ref, (snapshot) => {
      const novoCache = {};
      snapshot.forEach(doc => {
        const d = doc.data();
        if(!novoCache[d.servico]) novoCache[d.servico] = {};
        if(!novoCache[d.servico][d.data]) novoCache[d.servico][d.data] = {};
        novoCache[d.servico][d.data][d.horario] = { taken: true };
      });
      bookingsCache = novoCache;
      calendarRenderers.forEach(fn => fn());
    });
  }
  iniciarEscutaAgendamentos();

  // ============================================================
  // MODAL DE AGENDAMENTO
  // ============================================================
  function ensureBookingModal(){
    if(document.getElementById('bookingModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'bookingModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="bookingModalTitle">
        <button type="button" class="modal-close" id="bookingModalClose" aria-label="Fechar">&times;</button>
        <h3 id="bookingModalTitle">Confirmar agendamento</h3>
        <p class="modal-subtitle" id="bookingModalSubtitle"></p>
        <form id="bookingForm" novalidate>
          <label class="field-label" for="bookingCracha">Número do crachá</label>
          <input type="text" id="bookingCracha" name="cracha" required inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="Ex: 0123">
          
          <label class="field-label" for="bookingNome">Nome completo</label>
          <input type="text" id="bookingNome" name="nome" required autocomplete="name" placeholder="Seu nome">

          <label class="field-label" for="bookingContato">Telefone / WhatsApp</label>
          <input type="tel" id="bookingContato" name="contato" required autocomplete="tel" placeholder="(19) 99999-9999">

          <div class="term-box">
            <p><strong>Termo de agendamento:</strong> Ao confirmar, você reserva este horário em seu nome. Chegue com até 10 minutos de antecedência; atrasos superiores a 10 minutos poderão ocasionar a perda da vaga. <strong>Cancelamentos deverão ser comunicados à equipe do Grêmio com, no mínimo, 4 horas de antecedência.</strong>
Em caso de não comparecimento sem cancelamento prévio, será devida uma restituição simbólica no valor de <strong>R$ 25,00</strong> destinada a compensar a reserva do horário e a indisponibilidade da vaga para outros associados.</p>
          </div>
          <label class="checkbox-row" for="bookingTermo">
            <input type="checkbox" id="bookingTermo" name="termo" required>
            <span>Declaro que aceito os termos apresentados, bem como a restituição descrita neste termo.</span>
          </label>

          <p class="form-error" id="bookingFormError"></p>
          <button type="submit" class="book-btn" id="bookingConfirmBtn">Confirmar agendamento</button>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) closeBookingModal();
    });
    document.getElementById('bookingModalClose').addEventListener('click', closeBookingModal);
    document.getElementById('bookingCracha').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });
    document.getElementById('bookingContato').addEventListener('input', (e) => {
      let numeros = e.target.value.replace(/\D/g, '').slice(0, 11);
      let formatado = numeros;
      if(numeros.length > 0) formatado = '(' + numeros.slice(0, 2);
      if(numeros.length >= 3) formatado += ') ' + numeros.slice(2, 7);
      if(numeros.length >= 8) formatado += '-' + numeros.slice(7, 11);
      e.target.value = formatado;
    });
  }

  function openBookingModal(subtitle, onConfirm){
    ensureBookingModal();
    const overlay = document.getElementById('bookingModalOverlay');
    const form = document.getElementById('bookingForm');
    const errorEl = document.getElementById('bookingFormError');
    document.getElementById('bookingModalSubtitle').textContent = subtitle;
    form.reset();
    errorEl.textContent = '';
    if(window.socioAtual){
      document.getElementById('bookingNome').value = window.socioAtual.nome || '';
      document.getElementById('bookingCracha').value = window.socioAtual.cracha || '';
    }
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    form.onsubmit = (e) => {
      e.preventDefault();
      const nome = document.getElementById('bookingNome').value.trim();
      const contato = document.getElementById('bookingContato').value.trim();
      const cracha = document.getElementById('bookingCracha').value.trim();
      const aceitou = document.getElementById('bookingTermo').checked;

      if(!nome || !contato || !cracha){
        errorEl.textContent = 'Preencha nome, telefone/WhatsApp e número do crachá.';
        return;
      }
      if(!aceitou){
        errorEl.textContent = 'É preciso aceitar o termo de agendamento para confirmar.';
        return;
      }
      closeBookingModal();
      onConfirm({ nome, contato, cracha });
    };
  }

  function closeBookingModal(){
    const overlay = document.getElementById('bookingModalOverlay');
    if(overlay){
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // Popup de confirmação
  function showSuccessToast(mensagem, tipo){
    let toast = document.getElementById('successToast');
    if(!toast){
      toast = document.createElement('div');
      toast.id = 'successToast';
      document.body.appendChild(toast);
    }
    const isErro = tipo === 'erro';
    toast.className = isErro ? 'success-toast success-toast-erro' : 'success-toast';
    toast.innerHTML = `<span class="success-toast-icon">${isErro ? '!' : '✓'}</span><span>${escapeHtml(mensagem)}</span>`;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // ============================================================
  // CARDS DE EVENTOS
  // ============================================================
  let eventCards = [];

  function iniciarEscutaEventos(){
    if(!window.db){
      setTimeout(iniciarEscutaEventos, 200);
      return;
    }
    window.fbOnSnapshot(window.fbCollection(window.db, 'eventos'), (snapshot) => {
      eventCards = [];
      snapshot.forEach(doc => {
        eventCards.push(Object.assign({ id: doc.id }, doc.data()));
      });
      eventCards.sort((a, b) => (a.ordem ?? 999999) - (b.ordem ?? 999999));
      renderEventCards();
      renderTicker();
    });
  }
  iniciarEscutaEventos();

  function renderEventCards(){
    const grid = document.getElementById('eventCardsGrid');
    if(!grid) return;
    grid.innerHTML = eventCards.map(ev => {
      return `
        <article class="event-card">
          <img src="${escapeAttr(ev.imgData || ev.img || '')}" alt="${escapeAttr(ev.title)}" loading="lazy">
          <div class="event-card-body">
            <h3 class="event-card-title"><strong>${escapeHtml(ev.title)}</strong></h3>
            <p class="event-card-time">${escapeHtml(ev.time)}</p>
            <button type="button" class="book-btn event-join-btn" data-event-id="${escapeAttr(ev.id)}">Participar</button>
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('.event-join-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ev = eventCards.find(e => e.id === btn.dataset.eventId);
        if(!ev) return;
        openEventLinkModal(ev);
      });
    });
  }

  function ensureEventLinkModal(){
    if(document.getElementById('eventLinkModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'eventLinkModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="eventLinkModalTitle">
        <button type="button" class="modal-close" id="eventLinkModalClose" aria-label="Fechar">&times;</button>
        <h3 id="eventLinkModalTitle"></h3>
        <p class="modal-subtitle" id="eventLinkModalSubtitle"></p>
        <p id="eventLinkModalDescription" style="font-size:14px; color:var(--grey-dark); line-height:1.5; margin-bottom:18px; white-space:pre-line;"></p>
        <a href="#" target="_blank" rel="noopener" class="book-btn" id="eventLinkModalBtn" style="display:block; text-align:center; text-decoration:none;">Acesse o link aqui</a>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) closeEventLinkModal();
    });
    document.getElementById('eventLinkModalClose').addEventListener('click', closeEventLinkModal);
  }

  function openEventLinkModal(ev){
    ensureEventLinkModal();
    const overlay = document.getElementById('eventLinkModalOverlay');
    document.getElementById('eventLinkModalTitle').textContent = ev.title;
    document.getElementById('eventLinkModalSubtitle').textContent = ev.time;
    document.getElementById('eventLinkModalDescription').textContent = ev.description || '';
    const linkBtn = document.getElementById('eventLinkModalBtn');
    if(ev.link){
      linkBtn.href = ev.link;
      linkBtn.textContent = 'Acesse o link aqui';
      linkBtn.style.opacity = '1';
      linkBtn.style.pointerEvents = 'auto';
    } else {
      linkBtn.href = '#';
      linkBtn.textContent = 'Link em breve';
      linkBtn.style.opacity = '0.5';
      linkBtn.style.pointerEvents = 'none';
    }
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeEventLinkModal(){
    const overlay = document.getElementById('eventLinkModalOverlay');
    if(overlay){
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // ============================================================
  // CALENDÁRIO
  // ============================================================
  const DOW = ["D","S","T","Q","Q","S","S"];
  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

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
  function daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }
  function firstWeekday(y,m){ return new Date(y, m, 1).getDay(); }

  function buildCalendar(containerId, config){
    const container = document.getElementById(containerId);
    const today0 = todayDateOnly();
    let state = { year: today0.getFullYear(), month: today0.getMonth(), selected: null, selectedTime: null };
    let lastKnownToday = formatDateStr(today0);

    function getSlotsFromTemplate(template, dateStr){
      const savedDay = (loadBookings()[containerId] || {})[dateStr] || {};
      const agora = new Date();
      const ehHoje = dateStr === formatDateStr(agora);
      const horaAgora = String(agora.getHours()).padStart(2,'0') + ':' + String(agora.getMinutes()).padStart(2,'0');
      return (template || []).map(time => {
        const jaPassou = ehHoje && time <= horaAgora;
        return { time, taken: !!savedDay[time] || jaPassou };
      });
    }
    function getSlotsForDate(dateStr){
      return getSlotsFromTemplate(config.slotsTemplate, dateStr);
    }
    function getNoiteSlotsForDate(dateStr){
      if(config.diaNoite === undefined || config.diaNoite === null) return [];
      const weekday = new Date(dateStr + 'T00:00:00').getDay();
      if(weekday !== config.diaNoite) return [];
      return getSlotsFromTemplate(config.slotsNoite, dateStr);
    }

    function dayStatus(date, dateStr){
      const today = todayDateOnly();
      if(date < today) return "past";
      if(config.bloqueadoAte && dateStr <= config.bloqueadoAte) return "closed";
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
      if(date > endOfWeek) return "closed";
      const weekday = date.getDay();
      if(!(config.openWeekdays || []).includes(weekday)) return "closed";
      const slots = getSlotsForDate(dateStr).concat(getNoiteSlotsForDate(dateStr));
      if(slots.length && slots.every(s => s.taken)) return "full";
      return "available";
    }

    function render(){
      const meuAgendamento = getMeuAgendamento(config.configKey);
      if(meuAgendamento){
        const dataFormatada = meuAgendamento.data.split('-').reverse().join('/');
        container.innerHTML = `
          <div class="already-booked-card">
            <div class="already-booked-icon">✓</div>
            <h4>Agendamento confirmado</h4>
            <p>Você já garantiu sua vaga de <strong>${meuAgendamento.servico}</strong><br>em ${dataFormatada} às ${meuAgendamento.horario}.</p>
            <span class="already-booked-note">Só é possível ter 1 agendamento ativo por vez</span>
          </div>`;
        return;
      }

      const y = state.year, m = state.month;
      const total = daysInMonth(y,m);
      const startDow = firstWeekday(y,m);
      const todayStr = formatDateStr(todayDateOnly());

      if(state.selected && state.selected < todayStr){
        state.selected = null;
        state.selectedTime = null;
      }

      let dowHtml = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');
      let cellsHtml = '';
      for(let i=0;i<startDow;i++){ cellsHtml += `<div class="cal-day empty"></div>`; }
      for(let d=1; d<=total; d++){
        const date = new Date(y, m, d);
        const dateStr = formatDateStr(date);
        const status = dayStatus(date, dateStr);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === state.selected;
        let cls = "cal-day";
        if(status === "available") cls += " available";
        if(status === "full") cls += " full";
        if(status === "past") cls += " past";
        if(isToday) cls += " today";
        if(isSelected) cls += " selected";
        const disabled = status !== "available";
        cellsHtml += `<button type="button" class="${cls}" data-date="${dateStr}" data-status="${status}" ${disabled ? "disabled" : ""}>${d}</button>`;
      }

      const slotsForSelected = state.selected ? getSlotsForDate(state.selected) : null;
      const noiteSlotsForSelected = state.selected ? getNoiteSlotsForDate(state.selected) : null;
      let slotsHtml = '';
      if(state.selected && slotsForSelected){
        slotsHtml = `
          <div class="slots-box">
            <h4>Horários — ${state.selected.split('-').reverse().join('/')}</h4>
            <div class="slots">
              ${slotsForSelected.map(s => `<button type="button" class="slot ${s.taken ? 'taken':'free'} ${state.selectedTime===s.time?'chosen':''}" data-time="${s.time}" ${s.taken?'disabled':''}>${s.time}</button>`).join('')}
            </div>
            ${noiteSlotsForSelected && noiteSlotsForSelected.length ? `
              <h4 class="slots-subtitle">Noite</h4>
              <div class="slots">
                ${noiteSlotsForSelected.map(s => `<button type="button" class="slot ${s.taken ? 'taken':'free'} ${state.selectedTime===s.time?'chosen':''}" data-time="${s.time}" ${s.taken?'disabled':''}>${s.time}</button>`).join('')}
              </div>` : ''}
            <button class="book-btn" type="button" id="bookBtn-${containerId}" ${state.selectedTime ? '' : 'disabled'}>
              ${state.selectedTime ? 'Agendar horário de ' + state.selectedTime : 'Escolha um horário acima'}
            </button>
          </div>`;
      } else {
        slotsHtml = `
          <div class="slots-box">
            <h4>Selecione um dia disponível</h4>
            <p style="font-size:13px;color:var(--grey);">Os horários livres aparecem aqui assim que você escolher uma data em verde.</p>
          </div>`;
      }

      container.innerHTML = `
        <div class="cal-nav">
          <button type="button" data-nav="-1" aria-label="Mês anterior">‹</button>
          <span class="cal-month">${monthNames[m]} ${y}</span>
          <button type="button" data-nav="1" aria-label="Próximo mês">›</button>
        </div>
        <div class="cal-grid">${dowHtml}${cellsHtml}</div>
        <div class="cal-legend">
          <span><i class="dot av"></i> Vagas disponíveis</span>
          <span><i class="dot fu"></i> Agenda lotada</span>
        </div>
        ${slotsHtml}
      `;

      container.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = parseInt(btn.dataset.nav, 10);
          state.month += dir;
          if(state.month > 11){ state.month = 0; state.year++; }
          if(state.month < 0){ state.month = 11; state.year--; }
          state.selected = null;
          state.selectedTime = null;
          render();
        });
      });
      container.querySelectorAll('.cal-day.available').forEach(btn => {
        btn.addEventListener('click', () => {
          state.selected = btn.dataset.date;
          state.selectedTime = null;
          render();
        });
      });
      container.querySelectorAll('.slot.free').forEach(btn => {
        btn.addEventListener('click', () => {
          state.selectedTime = btn.dataset.time;
          render();
        });
      });
      const bookBtn = container.querySelector(`#bookBtn-${containerId}`);
      if(bookBtn){
        bookBtn.addEventListener('click', () => {
          if(!state.selected || !state.selectedTime) return;
          const dataFormatada = state.selected.split('-').reverse().join('/');
          const horarioEscolhido = state.selectedTime;
          openBookingModal(
            `${config.serviceName || 'Serviço'} — ${dataFormatada} às ${horarioEscolhido}`,
            async (dados) => {
              try{
                await saveBooking(containerId, state.selected, horarioEscolhido, dados);
                state.selectedTime = null;
                showSuccessToast(`Agendamento concluído! Te esperamos em ${dataFormatada} às ${horarioEscolhido}.`);
                await setMeuAgendamento(config.configKey, {
                  servico: config.serviceName || 'Serviço',
                  data: state.selected,
                  horario: horarioEscolhido
                });
              }catch(err){
                console.error('Erro ao salvar agendamento no Firestore:', err);
                const mensagemConflito = (err && err.message && err.message.includes('reservado por outra pessoa'))
                  ? err.message
                  : 'Ops! Não foi possível salvar seu agendamento. Tente novamente.';
                showSuccessToast(mensagemConflito, 'erro');
              }
            }
          );
        });
      }
    }

    render();
    calendarRenderers.push(render);

    // Dias de atendimento vindos do Firestore
    if(config.configKey){
      (function escutarConfigServico(){
        if(!window.db){ setTimeout(escutarConfigServico, 200); return; }
        window.fbOnSnapshot(window.fbDoc(window.db, 'config', config.configKey), (snap) => {
          if(!snap.exists()) return;
          const dados = snap.data();
          if(Array.isArray(dados.openWeekdays)) config.openWeekdays = dados.openWeekdays;
          if('diaNoite' in dados) config.diaNoite = dados.diaNoite;
          if('bloqueadoAte' in dados) config.bloqueadoAte = dados.bloqueadoAte;
          render();
        });
      })();
    }

    // Recalcula ao virar o dia
    setInterval(() => {
      const currentToday = formatDateStr(todayDateOnly());
      if(currentToday !== lastKnownToday){
        lastKnownToday = currentToday;
        render();
      }
    }, 60000);
  }

  // Manicure: sem horário noturno
  buildCalendar('cal-manicure', {
    serviceName: 'Manicure',
    configKey: 'manicure',
    openWeekdays: [3,5],
    slotsTemplate: ["11:00","11:30","12:00","12:30","13:00","13:30"]
  });

  // Massagem: noite apenas no dia definido pelo admin
  buildCalendar('cal-massage', {
    serviceName: 'Massagem',
    configKey: 'massagem',
    openWeekdays: [1,4],
    slotsTemplate: ["11:10","11:20","11:30","11:40","11:50","12:10","12:20","12:30","12:40","12:50","13:10","13:20","13:30","13:40","13:50"],
    slotsNoite: ["19:00","19:10","19:20","19:30","19:40","19:50","20:10","20:20","20:30","20:40","20:50"]
  });