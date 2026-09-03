// ---- Mobile nav toggle ----
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  navToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open);
  });

  // ==================================================================
  // ---- Login de sócios (crachá + PIN) via Firebase Auth ----
  // ==================================================================
  window.socioAtual = null; // { uid, cracha, nome } quando logado, null quando não

  function montarEmailSintetico(cracha){
    return `${cracha}@socios.gremio-miracema.local`;
  }
  function montarSenhaFirebase(pin){
    // Firebase exige senha com pelo menos 6 caracteres; dobramos o PIN de 4 dígitos por baixo dos panos
    return pin + pin;
  }

  async function tentarLoginOuCadastro(cracha, pin, nome){
    const email = montarEmailSintetico(cracha);
    const senha = montarSenhaFirebase(pin);
    try{
      await window.fbSignIn(window.auth, email, senha);
      // login OK — o onAuthStateChanged cuida do resto
    }catch(errLogin){
      // pode ser primeiro acesso (conta não existe) OU PIN errado — tenta criar a conta pra descobrir qual é
      try{
        const cred = await window.fbCreateUser(window.auth, email, senha);
        await window.fbSetDoc(window.fbDoc(window.db, 'socios', cred.user.uid), {
          cracha,
          nome: nome || '',
          criadoEm: window.fbServerTimestamp()
        });
        // conta criada com sucesso = era primeiro acesso mesmo — o onAuthStateChanged cuida do resto
      }catch(errCadastro){
        if(errCadastro.code === 'auth/email-already-in-use'){
          throw new Error('PIN incorreto. Confira os 4 dígitos ou fale com a recepção.');
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
    info.innerHTML = `Logado como <strong>${nome || 'sócio'}</strong> · <a href="#" id="socioLogoutLink">Sair</a>`;
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
      setTimeout(iniciarAuthListener, 200); // Firebase ainda carregando
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

  // ---- Máscara e validação do formulário de login ----
  document.getElementById('loginCracha').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });
  document.getElementById('loginPin').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });
  document.getElementById('socioLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cracha = document.getElementById('loginCracha').value.trim();
    const pin = document.getElementById('loginPin').value.trim();
    const nome = document.getElementById('loginNome').value.trim();
    const errorEl = document.getElementById('loginFormError');
    const btn = document.getElementById('loginSubmitBtn');
    errorEl.textContent = '';

    if(cracha.length !== 4 || pin.length !== 4){
      errorEl.textContent = 'Preencha o crachá e o PIN com 4 dígitos.';
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

  // ---- Modal "Sobre o Grêmio Recreativo" (botão "Quero ser sócio") ----
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
        <a href="mailto:gremio@miracema-nuodex.com.br" class="socio-modal-btn">Faça parte aqui</a>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) closeSocioModal();
    });
    document.getElementById('socioModalClose').addEventListener('click', closeSocioModal);
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

  // ---- News ticker: próximos eventos do grêmio (gerado a partir dos cards de eventos) ----
  const track = document.getElementById('tickerTrack');

  function parseEventDateAndDetail(timeStr){
    // separa a data do resto da string, ex: "02 AGO · 19h — Salão Social" ou "22 AGO — Sala de Jogos"
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
    const html = eventCards.map(ev => {
      const { date, detail } = parseEventDateAndDetail(ev.time);
      return `
        <div class="ticker-item">
          <span class="date-chip">${date}</span>
          <span>${ev.title}${detail ? ' — ' + detail : ''}</span>
        </div>`;
    }).join('');
    // duplicate for seamless loop
    track.innerHTML = html + html;
  }

  // ---- Persistência dos agendamentos (Firestore, em tempo real) ----
  // "vagas" = coleção pública, só trava o horário (sem dados pessoais) — o calendário lê daqui
  // "agendamentos" = coleção privada, com nome/contato/crachá — só admin autenticado consegue ler
  let bookingsCache = {}; // cópia local da coleção "vagas", mantida em sincronia com o Firestore
  const calendarRenderers = []; // cada calendário registra sua função de render aqui

  // ---- Controle de "já agendou": depois de 1 agendamento, trava os calendários pra essa pessoa ----
  // Agora vinculado à conta logada (Firestore), não mais ao navegador — e libera sozinho quando a semana vira
  let meuAgendamentoCache = null;
  let unsubscribeMeuAgendamento = null;

  function computeWeekStartStr(dateStr){
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - d.getDay()); // volta até domingo daquela semana
    return formatDateStr(d);
  }

  function iniciarEscutaMeuAgendamento(uid){
    if(unsubscribeMeuAgendamento){ unsubscribeMeuAgendamento(); unsubscribeMeuAgendamento = null; }
    if(!uid){
      meuAgendamentoCache = null;
      calendarRenderers.forEach(fn => fn());
      return;
    }
    const ref = window.fbDoc(window.db, 'meus-agendamentos', uid);
    unsubscribeMeuAgendamento = window.fbOnSnapshot(ref, (snap) => {
      if(snap.exists()){
        const info = snap.data();
        const semanaAtual = computeWeekStartStr(formatDateStr(todayDateOnly()));
        meuAgendamentoCache = (info.semanaKey === semanaAtual) ? info : null; // expira sozinho na virada da semana
      } else {
        meuAgendamentoCache = null;
      }
      calendarRenderers.forEach(fn => fn());
    });
  }

  function getMeuAgendamento(){
    return meuAgendamentoCache;
  }

  async function setMeuAgendamento(info){
    if(!window.socioAtual) return;
    const completo = Object.assign({}, info, { semanaKey: computeWeekStartStr(info.data) });
    await window.fbSetDoc(window.fbDoc(window.db, 'meus-agendamentos', window.socioAtual.uid), completo);
    // o onSnapshot acima já detecta e atualiza sozinho, sem precisar chamar render() aqui
  }

  function loadBookings(){
    return bookingsCache; // sempre lê da cópia local (atualizada pelo listener abaixo)
  }

  async function saveBooking(containerId, dateStr, time, dados){
    const criadoEm = window.fbServerTimestamp();
    await Promise.all([
      // registro público: só o essencial pra travar o horário no calendário
      window.fbAddDoc(window.fbCollection(window.db, 'vagas'), {
        servico: containerId,
        data: dateStr,
        horario: time,
        criadoEm
      }),
      // registro privado: dados completos, só o admin consegue ler depois
      window.fbAddDoc(window.fbCollection(window.db, 'agendamentos'), {
        servico: containerId,
        data: dateStr,
        horario: time,
        nome: dados.nome,
        contato: dados.contato,
        cracha: dados.cracha,
        aceitouTermo: true,
        criadoEm
      })
    ]);
    // não precisa atualizar bookingsCache na mão: o onSnapshot abaixo detecta e já atualiza sozinho
  }

  function iniciarEscutaAgendamentos(){
    if(!window.db){
      setTimeout(iniciarEscutaAgendamentos, 200); // Firebase ainda carregando, tenta de novo
      return;
    }
    const ref = window.fbCollection(window.db, 'vagas'); // lê da coleção pública (sem dados pessoais)
    window.fbOnSnapshot(ref, (snapshot) => {
      const novoCache = {};
      snapshot.forEach(doc => {
        const d = doc.data();
        if(!novoCache[d.servico]) novoCache[d.servico] = {};
        if(!novoCache[d.servico][d.data]) novoCache[d.servico][d.data] = {};
        novoCache[d.servico][d.data][d.horario] = { taken: true };
      });
      bookingsCache = novoCache;
      calendarRenderers.forEach(fn => fn()); // re-renderiza os calendários com os dados atualizados
    });
  }
  iniciarEscutaAgendamentos();

  // ---- Modal de dados + termo de agendamento ----
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
      let numeros = e.target.value.replace(/\D/g, '').slice(0, 11); // só dígitos, no máximo 11 (DDD + 9 dígitos)
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

  // ---- Popup verde de confirmação ----
  function showSuccessToast(mensagem){
    let toast = document.getElementById('successToast');
    if(!toast){
      toast = document.createElement('div');
      toast.id = 'successToast';
      toast.className = 'success-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="success-toast-icon">✓</span><span>${mensagem}</span>`;
    toast.classList.remove('show');
    // força reflow para reiniciar a animação se já estava visível
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // ---- Cards de eventos ----
  const eventCards = [
    { id: "domino-ago", img: "images/domino.png", title: "Torneio de dominó", time: "02 AGO · 19h — Salão Social", description: "Traga sua dupla e dispute o campeonato de dominó do grêmio. Inscrições limitadas, vagas por ordem de chegada.", link: "" },
    { id: "feijoada-ago", img: "images/feijoada.png", title: "Feijoada dos sócios", time: "08 AGO · 12h — Quiosque", description: "Feijoada completa com direito a música ao vivo. Aberto a sócios e convidados.", link: "" },
    { id: "karaoke-ago", img: "images/karaoke.png", title: "Noite do karaokê", time: "15 AGO · 20h — Salão de Festas", description: "Solte a voz na nossa noite de karaokê! Bar aberto e repertório variado.", link: "" },
    { id: "sinuca-ago", img: "images/sinuca.png", title: "Campeonato de sinuca", time: "22 AGO — Sala de Jogos", description: "Torneio eliminatório de sinuca. Inscrições na recepção até o dia do evento.", link: "" },
  ];

  function renderEventCards(){
    const grid = document.getElementById('eventCardsGrid');
    if(!grid) return;
    grid.innerHTML = eventCards.map(ev => {
      return `
        <article class="event-card">
          <img src="${ev.img}" alt="${ev.title}" loading="lazy">
          <div class="event-card-body">
            <h3 class="event-card-title">${ev.title}</h3>
            <p class="event-card-time">${ev.time}</p>
            <button type="button" class="book-btn event-join-btn" data-event-id="${ev.id}">Participar</button>
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

  // ---- Modal simples do evento (mesma estilização do modal de agendamento) ----
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
        <p id="eventLinkModalDescription" style="font-size:14px; color:var(--grey-dark); line-height:1.5; margin-bottom:18px;"></p>
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

  renderEventCards();
  renderTicker();

  // ---- Calendars ----
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
      return (template || []).map(time => ({ time, taken: !!savedDay[time] }));
    }
    function getSlotsForDate(dateStr){
      return getSlotsFromTemplate(config.slotsTemplate, dateStr);
    }
    function getNoiteSlotsForDate(dateStr){
      return getSlotsFromTemplate(config.slotsNoite, dateStr);
    }

    function dayStatus(date, dateStr){
      const today = todayDateOnly();
      if(date < today) return "past"; // dias anteriores a hoje: sempre indisponíveis
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (6 - today.getDay())); // sábado da semana vigente
      if(date > endOfWeek) return "closed"; // além da semana atual: travado
      const weekday = date.getDay();
      if(!(config.openWeekdays || []).includes(weekday)) return "closed";
      const slots = getSlotsForDate(dateStr).concat(getNoiteSlotsForDate(dateStr));
      if(slots.length && slots.every(s => s.taken)) return "full";
      return "available";
    }

    function render(){
      const meuAgendamento = getMeuAgendamento();
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

      // se o dia selecionado ficou no passado (ex: virou meia-noite com o modal aberto), limpa a seleção
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
                await setMeuAgendamento({
                  servico: config.serviceName || 'Serviço',
                  data: state.selected,
                  horario: horarioEscolhido
                });
              }catch(err){
                console.error('Erro ao salvar agendamento no Firestore:', err);
                showSuccessToast('Ops! Não foi possível salvar seu agendamento. Tente novamente.');
              }
            }
          );
        });
      }
    }

    render();
    calendarRenderers.push(render); // permite que o listener do Firestore atualize esse calendário

    // ---- Atualização automática: se a aba ficar aberta e o dia virar (meia-noite), recalcula sozinho ----
    setInterval(() => {
      const currentToday = formatDateStr(todayDateOnly());
      if(currentToday !== lastKnownToday){
        lastKnownToday = currentToday;
        render();
      }
    }, 60000);
  }

  // Manicure:  quarta e sexta
  buildCalendar('cal-manicure', {
    serviceName: 'Manicure',
    openWeekdays: [3,5], // quarta e sexta
    slotsTemplate: ["11:10","11:20","11:30","11:40","11:50","12:10","12:20","12:30","12:40","12:50","13:10","13:20","13:30","13:40","13:50"],
    slotsNoite: ["19:00","19:10","19:20","19:30","19:40","19:50","20:10","20:20","20:30","20:40","20:50"]
  });

  // Massagem: terça, quinta 
  buildCalendar('cal-massage', {
    serviceName: 'Massagem',
    openWeekdays: [1,4], // terça, quinta
    slotsTemplate: ["11:10","11:20","11:30","11:40","11:50","12:10","12:20","12:30","12:40","12:50","13:10","13:20","13:30","13:40","13:50"],
    slotsNoite: ["19:00","19:10","19:20","19:30","19:40","19:50","20:10","20:20","20:30","20:40","20:50"]
  });