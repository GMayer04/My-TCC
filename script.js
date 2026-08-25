// ---- Mobile nav toggle ----
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  navToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open);
  });

  // ---- News ticker: próximos eventos do grêmio ----
  const events = [
    { date: "02 AGO", text: "Torneio de dominó — Salão Social, 19h" },
    { date: "08 AGO", text: "Feijoada dos sócios — Quiosque, 12h" },
    { date: "15 AGO", text: "Noite do karaokê — Salão Festas, 20h" },
    { date: "22 AGO", text: "Campeonato de sinuca — Sala de Jogos" },
    { date: "29 AGO", text: "Aula aberta de dança — Salão Social, 18h30" },
    { date: "05 SET", text: "Assembleia geral de sócios — Auditório, 19h" },
  ];
  const track = document.getElementById('tickerTrack');
  function renderTicker(){
    const html = events.map(e => `
      <div class="ticker-item">
        <span class="date-chip">${e.date}</span>
        <span>${e.text}</span>
      </div>`).join('');
    // duplicate for seamless loop
    track.innerHTML = html + html;
  }
  renderTicker();

  // ---- Persistência dos agendamentos (localStorage) ----
  const BOOKINGS_KEY = 'miracema-agendamentos';

  function loadBookings(){
    try{
      return JSON.parse(localStorage.getItem(BOOKINGS_KEY)) || {};
    }catch(e){
      return {};
    }
  }
  function saveBooking(containerId, dateStr, time, dados){
    const all = loadBookings();
    if(!all[containerId]) all[containerId] = {};
    if(!all[containerId][dateStr]) all[containerId][dateStr] = {};
    all[containerId][dateStr][time] = {
       nome: dados.nome,
       contato: dados.contato,
       cracha: dados.cracha,
       aceitouTermo: true,
       criadoEm: new Date().toISOString()
    };
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(all));
  }

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
            <p><strong>Termo de agendamento:</strong> ao confirmar, você reserva este horário em seu nome. Chegue com até 10 minutos de antecedência; atrasos superiores a 15 minutos podem causar perda da vaga. Cancelamentos devem ser avisados com pelo menos 4 horas de antecedência pela recepção do Grêmio.</p>
          </div>
          <label class="checkbox-row" for="bookingTermo">
            <input type="checkbox" id="bookingTermo" name="termo" required>
            <span>Li e aceito o termo de agendamento acima.</span>
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
  }

  function openBookingModal(subtitle, onConfirm){
    ensureBookingModal();
    const overlay = document.getElementById('bookingModalOverlay');
    const form = document.getElementById('bookingForm');
    const errorEl = document.getElementById('bookingFormError');
    document.getElementById('bookingModalSubtitle').textContent = subtitle;
    form.reset();
    errorEl.textContent = '';
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
    { id: "domino-ago", img: "images/domino.png", title: "Torneio de dominó", time: "02 AGO · 19h — Salão Social", link: "" },
    { id: "feijoada-ago", img: "images/feijoada.png", title: "Feijoada dos sócios", time: "08 AGO · 12h — Quiosque", link: "" },
    { id: "karaoke-ago", img: "images/karaoke.png", title: "Noite do karaokê", time: "15 AGO · 20h — Salão de Festas", link: "" },
    { id: "sinuca-ago", img: "images/Sinuca.png", title: "Campeonato de sinuca", time: "22 AGO — Sala de Jogos", link: "" },
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
        if(!ev.link){
          console.warn(`Link do evento "${ev.title}" ainda não foi definido.`);
          return;
        }
        window.open(ev.link, '_blank');
      });
    });
  }

  renderEventCards();

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
            (dados) => {
              saveBooking(containerId, state.selected, horarioEscolhido, dados);
              state.selectedTime = null;
              render();
              showSuccessToast(`Agendamento concluído! Te esperamos em ${dataFormatada} às ${horarioEscolhido}.`);
            }
          );
        });
      }
    }

    render();

    // ---- Atualização automática: se a aba ficar aberta e o dia virar (meia-noite), recalcula sozinho ----
    setInterval(() => {
      const currentToday = formatDateStr(todayDateOnly());
      if(currentToday !== lastKnownToday){
        lastKnownToday = currentToday;
        render();
      }
    }, 60000);
  }

  // Manicure: quarta, quinta e sábado
  buildCalendar('cal-manicure', {
    serviceName: 'Manicure',
    openWeekdays: [3,4,6], // quarta, quinta, sábado
    slotsTemplate: ["11:00","11:10","11:20","11:30","11:40","11:50","12:10","12:20","12:30","12:40","12:50","13:10","13:20","13:30","13:40","13:50"],
    slotsNoite: ["19:00","19:10","19:20","19:30","19:40","19:50","20:10","20:20","20:30","20:40","20:50"]
  });

  // Massagem: terça, quinta e sexta
  buildCalendar('cal-massage', {
    serviceName: 'Massagem',
    openWeekdays: [2,4,5], // terça, quinta, sexta
    slotsTemplate: ["11:00","11:10","11:20","11:30","11:40","11:50","12:10","12:20","12:30","12:40","12:50","13:10","13:20","13:30","13:40","13:50"],
    slotsNoite: ["19:00","19:10","19:20","19:30","19:40","19:50","20:10","20:20","20:30","20:40","20:50"]
  });
