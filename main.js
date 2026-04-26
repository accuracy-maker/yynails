(function () {
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  var galleryViewport = document.getElementById("gallery-viewport");
  var galleryPrev = document.querySelector("[data-gallery-prev]");
  var galleryNext = document.querySelector("[data-gallery-next]");
  if (galleryViewport && galleryPrev && galleryNext) {
    var galleryTrack = galleryViewport.querySelector(".gallery-track");
    var galleryWrapper = galleryViewport.closest(".showcase-gallery");
    var gallerySlides = galleryTrack ? galleryTrack.querySelectorAll(".gallery-slide") : [];

    if (galleryTrack && gallerySlides.length) {
      galleryTrack.style.setProperty(
        "--gallery-visible-desktop",
        String(Math.min(gallerySlides.length, 3))
      );
    }

    function refreshGalleryState() {
      if (!galleryWrapper) return;
      var canScroll = galleryViewport.scrollWidth - galleryViewport.clientWidth > 2;
      galleryWrapper.classList.toggle("is-static", !canScroll);
    }

    function scrollGallery(direction) {
      var amount = Math.max(galleryViewport.clientWidth * 0.85, 280);
      galleryViewport.scrollBy({
        left: amount * direction,
        behavior: "smooth"
      });
    }

    galleryPrev.addEventListener("click", function () {
      scrollGallery(-1);
    });

    galleryNext.addEventListener("click", function () {
      scrollGallery(1);
    });

    refreshGalleryState();
    window.addEventListener("resize", refreshGalleryState);
  }

  var header = document.getElementById("site-header");
  var hero = document.getElementById("hero-scene");
  if (header) {
    function refreshHeaderState() {
      header.classList.toggle("site-header--scrolled", window.scrollY > 16);
    }

    refreshHeaderState();
    window.addEventListener("scroll", refreshHeaderState, { passive: true });
    window.addEventListener("resize", refreshHeaderState);
  }

  if (header && hero && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) header.classList.add("site-header--at-hero");
          else header.classList.remove("site-header--at-hero");
        });
      },
      { root: null, rootMargin: "-8px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(hero);
  }

  var toggle = document.querySelector(".menu-toggle");
  var panel = document.getElementById("mobile-nav");
  if (!toggle || !panel) return;

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
    if (open) {
      toggle.querySelector(".sr-only").textContent = "Close menu";
    } else {
      toggle.querySelector(".sr-only").textContent = "Open menu";
    }
  }

  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") === "true";
    setOpen(!open);
  });

  panel.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setOpen(false);
    });
  });

  window.addEventListener("resize", function () {
    if (window.matchMedia("(min-width: 768px)").matches) setOpen(false);
  });
})();

// ---- Booking widget ----
(function () {
  // TODO: paste your deployed Apps Script web app URL here
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzPptVRUu-YcR5SiH7ylS6oGILudAiMQSihpC_JtzQNFbYWD39Ru-ah7wAcEKJqCYFX/exec';

  var AVAILABLE_DAYS = [0, 3, 5, 6]; // Sun, Wed, Fri, Sat
  var MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
  var DAY_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  var state = { step: 1, service: '', duration: 90, date: '', time: '', calYear: 0, calMonth: 0 };

  var modal = document.getElementById('booking-modal');
  if (!modal) return;

  // Open
  document.querySelectorAll('[data-open-booking]').forEach(function (el) {
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      openModal();
    });
  });

  // Close
  modal.querySelectorAll('[data-bk-close]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !modal.hidden) closeModal();
  });
  document.getElementById('bk-done').addEventListener('click', closeModal);

  // Back buttons
  modal.querySelectorAll('[data-bk-back]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      goStep(parseInt(btn.getAttribute('data-bk-back'), 10));
    });
  });

  // Service selection
  modal.querySelectorAll('.bk-service-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.service  = btn.getAttribute('data-service');
      state.duration = parseInt(btn.getAttribute('data-duration'), 10);
      goStep(2);
    });
  });

  // Form submit
  document.getElementById('bk-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    submitBooking(ev.target);
  });

  function openModal() {
    state.step = 1; state.service = ''; state.date = ''; state.time = '';
    state.calYear = 0; state.calMonth = 0;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    goStep(1);
    modal.querySelector('.bk-panel').focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  function goStep(n) {
    state.step = n;
    for (var i = 1; i <= 5; i++) {
      var pane = document.getElementById('bk-pane-' + i);
      if (pane) pane.hidden = (i !== n);
    }
    modal.querySelectorAll('.bk-step').forEach(function (s) {
      var sn = parseInt(s.getAttribute('data-step'), 10);
      s.classList.toggle('is-active', sn === n);
      s.classList.toggle('is-done', sn < n);
    });
    if (n === 2) renderCalendar();
    if (n === 3) loadSlots();
    if (n === 4) renderSummary();
  }

  // ---- Calendar ----
  function renderCalendar() {
    if (!state.calYear) {
      var now = new Date();
      state.calYear  = now.getFullYear();
      state.calMonth = now.getMonth();
    }
    buildCalendar(state.calYear, state.calMonth);
  }

  function buildCalendar(year, month) {
    state.calYear = year; state.calMonth = month;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var firstDay     = new Date(year, month, 1).getDay();
    var daysInMonth  = new Date(year, month + 1, 0).getDate();
    var container    = document.getElementById('bk-cal');

    var html = '<div class="bk-cal-header">'
      + '<button class="bk-cal-nav" id="bk-cal-prev" type="button" aria-label="Previous month">&#8249;</button>'
      + '<span class="bk-cal-title">' + MONTH_NAMES[month] + ' ' + year + '</span>'
      + '<button class="bk-cal-nav" id="bk-cal-next" type="button" aria-label="Next month">&#8250;</button>'
      + '</div><div class="bk-cal-grid">';

    DAY_LABELS.forEach(function (l) {
      html += '<span class="bk-cal-label">' + l + '</span>';
    });
    for (var i = 0; i < firstDay; i++) {
      html += '<span class="bk-cal-empty"></span>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var date      = new Date(year, month, d);
      var dow       = date.getDay();
      var isPast    = date < today;
      var available = AVAILABLE_DAYS.indexOf(dow) !== -1;
      var dateStr   = year + '-' + pad2(month + 1) + '-' + pad2(d);
      if (isPast || !available) {
        html += '<span class="bk-cal-day is-disabled">' + d + '</span>';
      } else {
        var sel = state.date === dateStr ? ' is-selected' : '';
        html += '<button class="bk-cal-day' + sel + '" data-date="' + dateStr + '" type="button">' + d + '</button>';
      }
    }
    html += '</div>';
    container.innerHTML = html;

    document.getElementById('bk-cal-prev').addEventListener('click', function () {
      var m = state.calMonth - 1, y = state.calYear;
      if (m < 0) { m = 11; y--; }
      buildCalendar(y, m);
    });
    document.getElementById('bk-cal-next').addEventListener('click', function () {
      var m = state.calMonth + 1, y = state.calYear;
      if (m > 11) { m = 0; y++; }
      buildCalendar(y, m);
    });
    container.querySelectorAll('.bk-cal-day:not(.is-disabled)').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.date = btn.getAttribute('data-date');
        goStep(3);
      });
    });
  }

  // ---- Slots ----
  function loadSlots() {
    var container = document.getElementById('bk-slots');
    document.getElementById('bk-date-label').textContent = formatDate(state.date);
    container.innerHTML = '<p class="bk-loading">Loading available times…</p>';

    if (!SCRIPT_URL) {
      container.innerHTML = '<p class="bk-error">Online booking is not yet active.<br>Please call <a href="tel:+61481917479">0481 917 479</a> to book.</p>';
      return;
    }

    fetch(SCRIPT_URL + '?date=' + state.date + '&duration=' + state.duration)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.slots || data.slots.length === 0) {
          container.innerHTML = '<p class="bk-empty">No available times on this date. Please pick another day.</p>';
          return;
        }
        var html = '<div class="bk-slots-grid">';
        data.slots.forEach(function (slot) {
          html += '<button class="bk-slot-btn" data-time="' + slot + '" type="button">' + formatTime(slot) + '</button>';
        });
        container.innerHTML = html + '</div>';
        container.querySelectorAll('.bk-slot-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            state.time = btn.getAttribute('data-time');
            goStep(4);
          });
        });
      })
      .catch(function () {
        container.innerHTML = '<p class="bk-error">Could not load times. Please call <a href="tel:+61481917479">0481 917 479</a>.</p>';
      });
  }

  // ---- Summary ----
  function renderSummary() {
    document.getElementById('bk-summary').innerHTML =
      '<div class="bk-summary-row">'
      + '<span>' + state.service + '</span>'
      + '<span>' + formatDate(state.date) + ' at ' + formatTime(state.time) + '</span>'
      + '</div>';
  }

  // ---- Submit ----
  function submitBooking(form) {
    var btn = form.querySelector('[type="submit"]');
    btn.disabled = true; btn.textContent = 'Sending…';

    var name  = form.elements.name.value.trim();
    var phone = form.elements.phone.value.trim();
    var email = form.elements.email.value.trim();
    var notes = form.elements.notes.value.trim();

    if (!name || !phone || !email) {
      btn.disabled = false; btn.textContent = 'Confirm booking';
      return;
    }

    function onSuccess() {
      goStep(5);
      document.getElementById('bk-confirm-detail').textContent =
        state.service + ' · ' + formatDate(state.date) + ' at ' + formatTime(state.time);
    }

    if (!SCRIPT_URL) { onSuccess(); return; }

    var params = 'action=request'
      + '&date='     + encodeURIComponent(state.date)
      + '&time='     + encodeURIComponent(state.time)
      + '&duration=' + state.duration
      + '&service='  + encodeURIComponent(state.service)
      + '&name='     + encodeURIComponent(name)
      + '&phone='    + encodeURIComponent(phone)
      + '&email='    + encodeURIComponent(email)
      + '&notes='    + encodeURIComponent(notes);

    fetch(SCRIPT_URL + '?' + params)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) { onSuccess(); }
        else { throw new Error('not ok'); }
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Confirm booking';
        alert('Something went wrong. Please call 0481 917 479 to book.');
      });
  }

  // ---- Helpers ----
  function pad2(n) { return String(n).padStart(2, '0'); }

  function formatDate(str) {
    if (!str) return '';
    var p = str.split('-');
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function formatTime(str) {
    if (!str) return '';
    var p = str.split(':');
    var h = parseInt(p[0], 10), m = p[1];
    return (h % 12 || 12) + ':' + m + (h >= 12 ? ' pm' : ' am');
  }
})();
