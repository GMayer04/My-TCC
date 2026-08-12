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
      const aceitou = document.getElementById('bookingTermo').checked;

      if(!nome || !contato){
        errorEl.textContent = 'Preencha nome e telefone/WhatsApp para continuar.';
        return;
      }
      if(!aceitou){
        errorEl.textContent = 'É preciso aceitar o termo de agendamento para confirmar.';
        return;
      }
      closeBookingModal();
      onConfirm({ nome, contato });
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

  // ---- Calendars ----
  const DOW = ["D","S","T","Q","Q","S","S"];
  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  function buildCalendar(containerId, config){
    const container = document.getElementById(containerId);
    let state = { year: config.year, month: config.month, selected: null, selectedTime: null };

    // aplica agendamentos já salvos (localStorage) por cima dos dados padrão
    const saved = loadBookings()[containerId] || {};
    Object.keys(saved).forEach(dateStr => {
      if(!config.slots[dateStr]) return;
      Object.keys(saved[dateStr]).forEach(time => {
        const slot = config.slots[dateStr].find(s => s.time === time);
        if(slot) slot.taken = true;
      });
    });

    function daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }
    function firstWeekday(y,m){ return new Date(y, m, 1).getDay(); }

    function isDayFullyBooked(dateStr){
      const daySlots = config.slots[dateStr];
      if(!daySlots || !daySlots.length) return false;
      return daySlots.every(s => s.taken);
    }

    function dayStatus(dateStr){
      if(config.full.includes(dateStr) || isDayFullyBooked(dateStr)) return "full";
      if(config.available.includes(dateStr)) return "available";
      return "closed";
    }

    function render(){
      const y = state.year, m = state.month;
      const total = daysInMonth(y,m);
      const startDow = firstWeekday(y,m);
      const todayStr = new Date().toISOString().slice(0,10);

      let dowHtml = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('');
      let cellsHtml = '';
      for(let i=0;i<startDow;i++){ cellsHtml += `<div class="cal-day empty"></div>`; }
      for(let d=1; d<=total; d++){
        const mm = String(m+1).padStart(2,'0');
        const dd = String(d).padStart(2,'0');
        const dateStr = `${y}-${mm}-${dd}`;
        const status = dayStatus(dateStr);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === state.selected;
        let cls = "cal-day";
        if(status === "available") cls += " available";
        if(status === "full") cls += " full";
        if(isToday) cls += " today";
        if(isSelected) cls += " selected";
        cellsHtml += `<button type="button" class="${cls}" data-date="${dateStr}" data-status="${status}" ${status==="closed"?"disabled":""}>${d}</button>`;
      }

      const slotsForSelected = state.selected ? (config.slots[state.selected] || []) : null;
      let slotsHtml = '';
      if(state.selected && slotsForSelected){
        slotsHtml = `
          <div class="slots-box">
            <h4>Horários — ${state.selected.split('-').reverse().join('/')}</h4>
            <div class="slots">
              ${slotsForSelected.map(s => `<button type="button" class="slot ${s.taken ? 'taken':'free'} ${state.selectedTime===s.time?'chosen':''}" data-time="${s.time}" ${s.taken?'disabled':''}>${s.time}</button>`).join('')}
            </div>
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
          openBookingModal(
            `${config.serviceName || 'Serviço'} — ${dataFormatada} às ${state.selectedTime}`,
            (dados) => {
              // marca o horário como indisponível
              const slot = (config.slots[state.selected] || []).find(s => s.time === state.selectedTime);
              if(slot) slot.taken = true;
              saveBooking(containerId, state.selected, state.selectedTime, dados);

              state.selectedTime = null;
              render();
              showSuccessToast(`Agendamento concluído! Te esperamos em ${dataFormatada} às ${slot ? slot.time : ''}.`);
            }
          );
        });
      }
    }
    render();
  }

  // Manicure: quarta, quinta e sábado disponíveis em agosto/2026
  buildCalendar('cal-manicure', {
    serviceName: 'Manicure',
    year: 2026, month: 7, // agosto (0-indexed)
    available: ["2026-08-05","2026-08-06","2026-08-08","2026-08-12","2026-08-13","2026-08-15","2026-08-19","2026-08-20","2026-08-22","2026-08-26","2026-08-27","2026-08-29"],
    full: ["2026-08-01","2026-08-08"],
    slots: {
      "2026-08-05":[{time:"09:00"},{time:"10:00",taken:true},{time:"11:00"},{time:"14:00"},{time:"15:00",taken:true},{time:"16:00"}],
      "2026-08-06":[{time:"09:00",taken:true},{time:"10:00"},{time:"11:00"},{time:"14:00"},{time:"15:00"}],
      "2026-08-12":[{time:"09:00"},{time:"10:00"},{time:"11:00",taken:true},{time:"14:00"},{time:"15:00"}],
      "2026-08-13":[{time:"09:00"},{time:"10:00"},{time:"14:00",taken:true},{time:"16:00"}],
      "2026-08-15":[{time:"09:00"},{time:"10:00"},{time:"11:00"},{time:"12:00"}],
      "2026-08-19":[{time:"09:00"},{time:"10:00",taken:true},{time:"14:00"},{time:"15:00"}],
      "2026-08-20":[{time:"09:00"},{time:"11:00"},{time:"14:00"},{time:"16:00",taken:true}],
      "2026-08-22":[{time:"09:00"},{time:"10:00"},{time:"11:00"},{time:"12:00"}],
      "2026-08-26":[{time:"09:00",taken:true},{time:"10:00"},{time:"14:00"}],
      "2026-08-27":[{time:"09:00"},{time:"10:00"},{time:"11:00"},{time:"15:00"}],
      "2026-08-29":[{time:"09:00"},{time:"10:00"},{time:"11:00"},{time:"12:00"}],
    }
  });

  // Massagem: terça, quinta e sexta disponíveis em agosto/2026
  buildCalendar('cal-massage', {
    serviceName: 'Massagem',
    year: 2026, month: 7,
    available: ["2026-08-04","2026-08-06","2026-08-07","2026-08-11","2026-08-13","2026-08-14","2026-08-18","2026-08-20","2026-08-21","2026-08-25","2026-08-27","2026-08-28"],
    full: ["2026-08-14","2026-08-28"],
    slots: {
      "2026-08-04":[{time:"10:00"},{time:"11:00",taken:true},{time:"15:00"},{time:"16:00"}],
      "2026-08-06":[{time:"10:00"},{time:"11:00"},{time:"15:00",taken:true},{time:"17:00"}],
      "2026-08-07":[{time:"10:00"},{time:"11:00"},{time:"15:00"},{time:"16:00"}],
      "2026-08-11":[{time:"10:00",taken:true},{time:"11:00"},{time:"16:00"}],
      "2026-08-13":[{time:"10:00"},{time:"11:00"},{time:"15:00"},{time:"16:00",taken:true}],
      "2026-08-18":[{time:"10:00"},{time:"11:00"},{time:"15:00"}],
      "2026-08-20":[{time:"10:00"},{time:"11:00",taken:true},{time:"16:00"},{time:"17:00"}],
      "2026-08-21":[{time:"10:00"},{time:"11:00"},{time:"15:00"},{time:"16:00"}],
      "2026-08-25":[{time:"10:00"},{time:"15:00"},{time:"16:00"}],
      "2026-08-27":[{time:"10:00"},{time:"11:00"},{time:"15:00"},{time:"16:00"}],
    }
  });
