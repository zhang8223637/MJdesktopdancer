(function () {
  function computeBassEnergy(freqData, bassRange) {
    var lo = Math.max(0, bassRange[0] | 0);
    var hi = Math.min(freqData.length, bassRange[1] | 0);
    if (hi <= lo) return 0;
    var sum = 0;
    for (var i = lo; i < hi; i++) sum += freqData[i];
    return sum / (hi - lo);
  }

  function computeAverage(arr) {
    if (!arr.length) return 0;
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
  }

  function createBeatDetector(opts) {
    var getConfig = opts.getConfig;
    var onBeat = opts.onBeat;
    var onError = opts.onError;
    var onStatus = opts.onStatus;

    var audioCtx = null;
    var analyser = null;
    var source = null;
    var stream = null;
    var freqData = null;
    var rafId = null;
    var energyHistory = [];
    var lastBeatTime = 0;

    function start() {
      return navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        })
        .then(function (s) {
          stream = s;
          audioCtx = new AudioContext();
          source = audioCtx.createMediaStreamSource(stream);
          analyser = audioCtx.createAnalyser();

          var cfg = getConfig();
          analyser.fftSize = cfg.fftSize;
          analyser.smoothingTimeConstant = 0.4;
          source.connect(analyser);

          freqData = new Uint8Array(analyser.frequencyBinCount);
          energyHistory = [];
          lastBeatTime = 0;

          if (onStatus) onStatus('🎵 监听中');

          function tick() {
            if (!analyser) return;

            analyser.getByteFrequencyData(freqData);
            var c = getConfig();
            if (analyser.fftSize !== c.fftSize) {
              analyser.fftSize = c.fftSize;
              freqData = new Uint8Array(analyser.frequencyBinCount);
              energyHistory = [];
            }

            var bass = computeBassEnergy(freqData, c.bassRange);
            energyHistory.push(bass);
            if (energyHistory.length > c.historySize) energyHistory.shift();
            var avg = computeAverage(energyHistory);

            var now = performance.now();
            var isBeat =
              bass > avg * c.beatThreshold && bass > c.minEnergy && now - lastBeatTime > c.beatCooldownMs;

            if (isBeat) {
              lastBeatTime = now;
              if (onBeat) onBeat({ energy: bass, avg: avg });
            }

            rafId = requestAnimationFrame(tick);
          }

          rafId = requestAnimationFrame(tick);
        })
        .catch(function (e) {
          if (onStatus) onStatus('❌ ' + e.message);
          if (onError) onError(e);
        });
    }

    function stop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (audioCtx) audioCtx.close().catch(function () {});
      audioCtx = null;
      analyser = null;
      source = null;
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
      return Promise.resolve();
    }

    return { start: start, stop: stop };
  }

  window.mjBeatDetector = { createBeatDetector: createBeatDetector };
})();

