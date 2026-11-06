/* ==========================================================================
   InfCoiL Minimalist Paper Page — Client Script (app.js)
   Browser-native · Elapsed-second comparison sync · BibTeX copy status
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. SYNCHRONIZED MONITOR BASELINE COMPARISON (ELAPSED SECONDS)
     ------------------------------------------------------------------------ */
  const BASELINES = {
    sft: {
      key: 'sft',
      pillLabel: 'SFT Cascade Baseline',
      durationMeta: '2.83 s recording (85 frames @ 30 fps)',
      endedText: 'Baseline recording ended at 2.83 s (holding final frame)',
      caption: 'Open-loop SFT cascade rollout ends at 2.83 s in this recorded example.',
      videoSrc: 'assets/v2/monitor-sft.mp4',
      posterSrc: 'assets/v2/monitor-sft-poster.jpg',
      nominalDuration: 2.833
    },
    student: {
      key: 'student',
      pillLabel: 'InterMimic Student Baseline',
      durationMeta: '3.00 s recording (90 frames @ 30 fps)',
      endedText: 'Baseline recording ended at 3.00 s (holding final frame)',
      caption: 'Open-loop InterMimic student rollout ends at 3.00 s without closed-loop replanning.',
      videoSrc: 'assets/v2/monitor-student.mp4',
      posterSrc: 'assets/v2/monitor-student-poster.jpg',
      nominalDuration: 3.0
    }
  };

  let activeBaselineKey = 'sft';
  const oursNominalDuration = 13.3;
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
  const syncPlayLabel = document.getElementById('sync-play-label');
  const syncRestartBtn = document.getElementById('sync-restart-btn');
  const syncScrubber = document.getElementById('sync-scrubber');
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
    if (syncPlayLabel) {
      syncPlayLabel.textContent = playing ? 'Pause' : 'Play both';
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
      if (baselineVideo.readyState >= 1 && Math.abs(baselineVideo.currentTime - freezeThreshold) > 0.015) {
        try {
          baselineVideo.currentTime = freezeThreshold;
        } catch (e) {}
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
        } catch (e) {}
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
        try {
          baselineVideo.currentTime = 0;
        } catch (e) {}
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
      if (syncTotalTime) syncTotalTime.textContent = d.toFixed(2) + 's';
      updateComparisonClock();
    });

    oursVideo.addEventListener('timeupdate', updateComparisonClock);

    oursVideo.addEventListener('seeking', updateComparisonClock);

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

  /* Pause videos inside any disclosure when collapsed */
  const allDetails = document.querySelectorAll('details.section-details');
  allDetails.forEach(function (detailsEl) {
    detailsEl.addEventListener('toggle', function () {
      if (!detailsEl.open) {
        const videos = detailsEl.querySelectorAll('video');
        videos.forEach(function (v) {
          if (!v.paused) {
            v.pause();
          }
        });
        updatePlayButtonUI();
      }
    });
  });

  /* ------------------------------------------------------------------------
     2. BIBTEX CITATION COPY WITH ACCESSIBLE SUCCESS/FAILURE STATUS
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
          if (copyBibtexLabel) copyBibtexLabel.textContent = 'Copy failed';
          if (bibtexCopyStatus) {
            bibtexCopyStatus.textContent = 'Copy failed \u2014 text selected (press Ctrl/Cmd+C).';
          }
        }

        setTimeout(function () {
          if (copyBibtexLabel) copyBibtexLabel.textContent = 'Copy';
          if (bibtexCopyStatus) bibtexCopyStatus.textContent = '';
        }, 3500);
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
