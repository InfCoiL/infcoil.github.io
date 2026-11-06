/* ==========================================================================
   InfCoiL Homepage V3 — Synchronized Video Comparison & Page Logic (app.js)
   Zero External Dependencies · Elapsed-Second Sync · Accessible Controls
   ========================================================================== */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------------------
     1. MOBILE & DESKTOP NAVIGATION
     ------------------------------------------------------------------------ */
  const navToggle = document.getElementById('nav-toggle');
  const primaryNav = document.getElementById('primary-nav');
  const navLinks = document.querySelectorAll('.nav-link');

  function closeMobileNav(restoreFocus) {
    if (!navToggle || !primaryNav) return;
    if (!primaryNav.classList.contains('is-open')) return;
    primaryNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      navToggle.focus();
    }
  }

  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', function () {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      primaryNav.classList.toggle('is-open', !expanded);
    });

    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        closeMobileNav(false);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && primaryNav.classList.contains('is-open')) {
        closeMobileNav(true);
      }
    });
  }

  /* ------------------------------------------------------------------------
     2. SYNCHRONIZED SIDE-BY-SIDE MONITOR VIDEO COMPARISON
        Synchronized by actual elapsed seconds (NOT normalized progress).
        Baseline freezes at its final frame (2.83s or 3.00s) with badge.
     ------------------------------------------------------------------------ */
  const BASELINES = {
    sft: {
      key: 'sft',
      pillLabel: 'SFT Cascade Baseline',
      durationMeta: '2.83s recording (85 frames @ 30fps)',
      endedText: 'Recording ended at 2.83s',
      cutoffLabel: 'Baseline ends: 2.83s',
      caption:
        'Open-loop SFT cascade rollout terminates early at 2.83s (85 frames) in this recorded example.',
      videoSrc: 'assets/v2/monitor-sft.mp4',
      posterSrc: 'assets/v2/monitor-sft-poster.jpg',
      nominalDuration: 2.833
    },
    student: {
      key: 'student',
      pillLabel: 'InterMimic Student Baseline',
      durationMeta: '3.00s recording (90 frames @ 30fps)',
      endedText: 'Recording ended at 3.00s',
      cutoffLabel: 'Baseline ends: 3.00s',
      caption:
        'Open-loop InterMimic student rollout terminates early at 3.00s (90 frames) without closed-loop replanning.',
      videoSrc: 'assets/v2/monitor-student.mp4',
      posterSrc: 'assets/v2/monitor-student-poster.jpg',
      nominalDuration: 3.0
    }
  };

  let activeBaselineKey = 'sft';
  let oursNominalDuration = 13.3;
  let rafId = null;
  let isUserScrubbing = false;

  const oursVideo = document.getElementById('comp-video-ours');
  const baselineVideo = document.getElementById('comp-video-baseline');
  const baselineSource = document.getElementById('comp-source-baseline');
  const baselineTabs = document.querySelectorAll('.baseline-tab');

  const baselinePillLabel = document.getElementById('baseline-pill-label');
  const baselineDurationMeta = document.getElementById('baseline-duration-meta');
  const baselineEndedBadge = document.getElementById('baseline-ended-badge');
  const baselineEndedText = document.getElementById('baseline-ended-text');
  const baselinePaneCaption = document.getElementById('baseline-pane-caption');

  const syncPlayBtn = document.getElementById('sync-play-btn');
  const syncPlayGlyph = document.getElementById('sync-play-glyph');
  const syncPlayLabel = document.getElementById('sync-play-label');
  const syncRestartBtn = document.getElementById('sync-restart-btn');
  const syncScrubber = document.getElementById('sync-scrubber');
  const scrubberCutoffLabel = document.getElementById('scrubber-cutoff-label');
  const scrubberMaxLabel = document.getElementById('scrubber-max-label');
  const syncCurrentTime = document.getElementById('sync-current-time');
  const syncTotalTime = document.getElementById('sync-total-time');

  function getOursDuration() {
    if (oursVideo && Number.isFinite(oursVideo.duration) && oursVideo.duration > 0) {
      return oursVideo.duration;
    }
    return oursNominalDuration;
  }

  function getBaselineDuration() {
    const cfg = BASELINES[activeBaselineKey] || BASELINES.sft;
    if (baselineVideo && Number.isFinite(baselineVideo.duration) && baselineVideo.duration > 0) {
      return baselineVideo.duration;
    }
    return cfg.nominalDuration;
  }

  function updatePlayButtonUI() {
    if (!oursVideo || !syncPlayBtn) return;
    const playing = !oursVideo.paused && !oursVideo.ended;
    syncPlayBtn.setAttribute('aria-pressed', String(playing));
    if (syncPlayGlyph) {
      syncPlayGlyph.textContent = playing ? '\u275A\u275A' : '\u25B6';
    }
    if (syncPlayLabel) {
      syncPlayLabel.textContent = playing ? 'Pause' : 'Play';
    }
  }

  function syncBaselineToElapsedTime(elapsedSec, shouldPlayIfBeforeCutoff) {
    if (!baselineVideo) return;
    const baseDur = getBaselineDuration();
    const freezeThreshold = Math.max(0, baseDur - 0.03);

    if (elapsedSec >= freezeThreshold) {
      if (!baselineVideo.paused) {
        baselineVideo.pause();
      }
      if (baselineVideo.readyState >= 1) {
        try {
          baselineVideo.currentTime = freezeThreshold;
        } catch (e) {
          /* ignore seek before metadata */
        }
      }
      if (baselineEndedBadge) {
        baselineEndedBadge.hidden = false;
      }
    } else {
      if (baselineEndedBadge) {
        baselineEndedBadge.hidden = true;
      }
      if (baselineVideo.readyState >= 1 && Math.abs(baselineVideo.currentTime - elapsedSec) > 0.12) {
        try {
          baselineVideo.currentTime = elapsedSec;
        } catch (e) {
          /* ignore seek before metadata */
        }
      }
      if (shouldPlayIfBeforeCutoff && baselineVideo.paused) {
        const p = baselineVideo.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {});
        }
      }
    }
  }

  function updateComparisonClock() {
    if (!oursVideo) return;
    const t = oursVideo.currentTime || 0;
    const total = getOursDuration();

    if (!isUserScrubbing && syncScrubber) {
      syncScrubber.max = total.toFixed(2);
      syncScrubber.value = Math.min(t, total).toFixed(3);
    }
    if (syncCurrentTime) {
      syncCurrentTime.textContent = t.toFixed(2) + 's';
    }
    if (syncTotalTime) {
      syncTotalTime.textContent = total.toFixed(2) + 's';
    }

    const oursPlaying = !oursVideo.paused && !oursVideo.ended;
    syncBaselineToElapsedTime(t, oursPlaying);
  }

  function tickLoop() {
    updateComparisonClock();
    if (oursVideo && !oursVideo.paused && !oursVideo.ended) {
      rafId = requestAnimationFrame(tickLoop);
    } else {
      rafId = null;
    }
  }

  function startSynchronizedPlayback() {
    if (!oursVideo) return;
    if (oursVideo.ended || oursVideo.currentTime >= getOursDuration() - 0.05) {
      oursVideo.currentTime = 0;
      if (baselineVideo && baselineVideo.readyState >= 1) {
        baselineVideo.currentTime = 0;
      }
      if (baselineEndedBadge) {
        baselineEndedBadge.hidden = true;
      }
    }

    const playPromise = oursVideo.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        updatePlayButtonUI();
      });
    }
    syncBaselineToElapsedTime(oursVideo.currentTime || 0, true);
    updatePlayButtonUI();
    if (!rafId) {
      rafId = requestAnimationFrame(tickLoop);
    }
  }

  function pauseSynchronizedPlayback() {
    if (oursVideo && !oursVideo.paused) {
      oursVideo.pause();
    }
    if (baselineVideo && !baselineVideo.paused) {
      baselineVideo.pause();
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    updatePlayButtonUI();
  }

  function restartSynchronizedPlayback() {
    if (!oursVideo) return;
    oursVideo.currentTime = 0;
    if (baselineVideo && baselineVideo.readyState >= 1) {
      try {
        baselineVideo.currentTime = 0;
      } catch (e) {}
    }
    if (baselineEndedBadge) {
      baselineEndedBadge.hidden = true;
    }
    updateComparisonClock();
    startSynchronizedPlayback();
  }

  function switchBaseline(baselineKey) {
    const cfg = BASELINES[baselineKey];
    if (!cfg) return;
    activeBaselineKey = baselineKey;

    baselineTabs.forEach(function (tab) {
      const match = tab.getAttribute('data-baseline') === baselineKey;
      tab.classList.toggle('is-active', match);
      tab.setAttribute('aria-pressed', String(match));
    });

    if (baselinePillLabel) baselinePillLabel.textContent = cfg.pillLabel;
    if (baselineDurationMeta) baselineDurationMeta.textContent = cfg.durationMeta;
    if (baselineEndedText) baselineEndedText.textContent = cfg.endedText;
    if (scrubberCutoffLabel) scrubberCutoffLabel.textContent = cfg.cutoffLabel;
    if (baselinePaneCaption) baselinePaneCaption.textContent = cfg.caption;

    if (baselineVideo) {
      const wasPlaying = oursVideo && !oursVideo.paused && !oursVideo.ended;
      const currentElapsed = oursVideo ? oursVideo.currentTime || 0 : 0;

      baselineVideo.poster = cfg.posterSrc;
      if (baselineSource) {
        baselineSource.src = cfg.videoSrc;
      }
      baselineVideo.src = cfg.videoSrc;
      baselineVideo.load();

      baselineVideo.addEventListener(
        'loadedmetadata',
        function onMeta() {
          baselineVideo.removeEventListener('loadedmetadata', onMeta);
          syncBaselineToElapsedTime(currentElapsed, wasPlaying);
        },
        { once: true }
      );

      syncBaselineToElapsedTime(currentElapsed, wasPlaying);
    }
  }

  baselineTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchBaseline(tab.getAttribute('data-baseline'));
    });
  });

  if (oursVideo) {
    oursVideo.addEventListener('loadedmetadata', function () {
      const d = getOursDuration();
      if (syncScrubber) syncScrubber.max = d.toFixed(2);
      if (scrubberMaxLabel) scrubberMaxLabel.textContent = d.toFixed(2) + 's';
      if (syncTotalTime) syncTotalTime.textContent = d.toFixed(2) + 's';
      updateComparisonClock();
    });

    oursVideo.addEventListener('timeupdate', updateComparisonClock);

    oursVideo.addEventListener('play', function () {
      updatePlayButtonUI();
      syncBaselineToElapsedTime(oursVideo.currentTime || 0, true);
      if (!rafId) {
        rafId = requestAnimationFrame(tickLoop);
      }
    });

    oursVideo.addEventListener('pause', function () {
      if (baselineVideo && !baselineVideo.paused) {
        baselineVideo.pause();
      }
      updatePlayButtonUI();
    });

    oursVideo.addEventListener('ended', function () {
      if (baselineVideo && !baselineVideo.paused) {
        baselineVideo.pause();
      }
      updateComparisonClock();
      updatePlayButtonUI();
    });

    // Polite autoplay on load if reduced motion is not active
    if (!prefersReducedMotion.matches) {
      startSynchronizedPlayback();
    } else {
      updatePlayButtonUI();
    }
  }

  if (baselineVideo) {
    baselineVideo.addEventListener('ended', function () {
      if (baselineEndedBadge) {
        baselineEndedBadge.hidden = false;
      }
    });
  }

  if (syncPlayBtn) {
    syncPlayBtn.addEventListener('click', function () {
      if (!oursVideo) return;
      if (oursVideo.paused || oursVideo.ended) {
        startSynchronizedPlayback();
      } else {
        pauseSynchronizedPlayback();
      }
    });
  }

  if (syncRestartBtn) {
    syncRestartBtn.addEventListener('click', function () {
      restartSynchronizedPlayback();
    });
  }

  if (syncScrubber && oursVideo) {
    syncScrubber.addEventListener('input', function () {
      isUserScrubbing = true;
      const targetSec = parseFloat(syncScrubber.value) || 0;
      try {
        oursVideo.currentTime = targetSec;
      } catch (e) {}
      if (syncCurrentTime) {
        syncCurrentTime.textContent = targetSec.toFixed(2) + 's';
      }
      const playing = !oursVideo.paused && !oursVideo.ended;
      syncBaselineToElapsedTime(targetSec, playing);
    });

    syncScrubber.addEventListener('change', function () {
      isUserScrubbing = false;
      updateComparisonClock();
    });
  }

  /* ------------------------------------------------------------------------
     3. 3D PLAYGROUND FULLSCREEN BUTTON
     ------------------------------------------------------------------------ */
  const playgroundFullscreenBtn = document.getElementById('playground-fullscreen-btn');
  const playgroundFrameShell = document.getElementById('playground-frame-shell');

  if (playgroundFullscreenBtn && playgroundFrameShell) {
    playgroundFullscreenBtn.addEventListener('click', function () {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function () {});
      } else if (playgroundFrameShell.requestFullscreen) {
        playgroundFrameShell.requestFullscreen().catch(function () {
          window.open('playground.html', '_blank', 'noopener');
        });
      } else {
        window.open('playground.html', '_blank', 'noopener');
      }
    });
  }

  /* ------------------------------------------------------------------------
     4. ACCESSIBLE FIGURE LIGHTBOX MODAL
     ------------------------------------------------------------------------ */
  const lightboxModal = document.getElementById('figure-lightbox');
  const lightboxBackdrop = document.getElementById('lightbox-backdrop');
  const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxTriggers = document.querySelectorAll('.lightbox-trigger');

  let lastFocusedTrigger = null;

  function openLightbox(triggerEl) {
    if (!lightboxModal || !lightboxImg) return;
    lastFocusedTrigger = triggerEl;

    const src = triggerEl.getAttribute('data-lightbox-src');
    const title = triggerEl.getAttribute('data-lightbox-title') || 'Figure View';
    const caption = triggerEl.getAttribute('data-lightbox-caption') || '';

    lightboxImg.src = src;
    lightboxImg.alt = title;
    if (lightboxTitle) lightboxTitle.textContent = title;
    if (lightboxCaption) lightboxCaption.textContent = caption;

    lightboxModal.hidden = false;
    document.body.style.overflow = 'hidden';

    if (lightboxCloseBtn) {
      lightboxCloseBtn.focus();
    }
  }

  function closeLightbox() {
    if (!lightboxModal || lightboxModal.hidden) return;
    lightboxModal.hidden = true;
    document.body.style.overflow = '';

    if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
      lastFocusedTrigger.focus();
      lastFocusedTrigger = null;
    }
  }

  lightboxTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      openLightbox(trigger);
    });
  });

  if (lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener('click', closeLightbox);
  }

  if (lightboxBackdrop) {
    lightboxBackdrop.addEventListener('click', closeLightbox);
  }

  document.addEventListener('keydown', function (event) {
    if (!lightboxModal || lightboxModal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
    } else if (event.key === 'Tab' && lightboxCloseBtn) {
      event.preventDefault();
      lightboxCloseBtn.focus();
    }
  });

  /* ------------------------------------------------------------------------
     5. BIBTEX CITATION COPY WITH FALLBACK
     ------------------------------------------------------------------------ */
  const copyBibtexBtn = document.getElementById('copy-bibtex-btn');
  const copyBibtexLabel = document.getElementById('copy-bibtex-label');
  const bibtexCopyStatus = document.getElementById('bibtex-copy-status');
  const bibtexCodeEl = document.getElementById('bibtex-code');

  function fallbackCopyText(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (err) {
      return false;
    }
  }

  function selectBibtexPre() {
    if (!bibtexCodeEl || !window.getSelection) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(bibtexCodeEl);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  if (copyBibtexBtn && bibtexCodeEl) {
    copyBibtexBtn.addEventListener('click', function () {
      const rawText = bibtexCodeEl.textContent.trim();

      function announceCopy(success) {
        if (success) {
          if (copyBibtexLabel) copyBibtexLabel.textContent = 'Copied';
          if (bibtexCopyStatus) bibtexCopyStatus.textContent = 'Copied to clipboard.';
        } else {
          selectBibtexPre();
          if (copyBibtexLabel) copyBibtexLabel.textContent = 'Selected';
          if (bibtexCopyStatus) bibtexCopyStatus.textContent = 'Citation selected \u2014 press Ctrl/Cmd+C to copy.';
        }

        setTimeout(function () {
          if (copyBibtexLabel) copyBibtexLabel.textContent = 'Copy BibTeX';
          if (bibtexCopyStatus) bibtexCopyStatus.textContent = '';
        }, 3200);
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
        navigator.clipboard
          .writeText(rawText)
          .then(function () {
            announceCopy(true);
          })
          .catch(function () {
            const ok = fallbackCopyText(rawText);
            announceCopy(ok);
          });
      } else {
        const ok = fallbackCopyText(rawText);
        announceCopy(ok);
      }
    });
  }
})();
