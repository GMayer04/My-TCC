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

  // ---- Calendars ----
  const DOW = ["D","S","T","Q","Q","S","S"];
  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  function buildCalendar(containerId, config){
    const container = document.getElementById(containerId);
    let state = { year: config.year, month: config.month, selected: null };

    function daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }
    function firstWeekday(y,m){ return new Date(y, m, 1).getDay(); }

    function dayStatus(dateStr){
      if(config.full.includes(dateStr)) return "full";
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
              ${slotsForSelected.map(s => `<span class="slot ${s.taken ? 'taken':'free'}">${s.time}</span>`).join('')}
            </div>
            <button class="book-btn" type="button">Agendar este horário</button>
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
          render();
        });
      });
      container.querySelectorAll('.cal-day.available').forEach(btn => {
        btn.addEventListener('click', () => {
          state.selected = btn.dataset.date;
          render();
        });
      });
    }
    render();
  }

  // Manicure: quarta, quinta e sábado disponíveis em agosto/2026
  buildCalendar('cal-manicure', {
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
