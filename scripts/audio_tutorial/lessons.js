(() => {
  "use strict";

  const { visuals } = window.AudioTutorial;

const STEPS = [
  {
    kicker:"01 · Signal basics", title:"A signal is a changing message", short:"Signal basics",
    intuition:`A signal is anything that carries information by <b>changing over something measurable</b>. The parameter might be time, space, or position. A traffic light, a heartbeat sensor, a picture, and a song all become signals once we measure their changing values.`,
    takeaway:`Notebook idea: signals feel broad, but the common thread is simple: <b>signals convey messages</b>.`,
    chips:["message","measurement","parameter"],
    math:`<p>A technical way to say this is: a signal is a function over a parameter.</p><p>For audio, the parameter is usually time, so we write $$x(t)$$ for continuous sound pressure and $$x[n]$$ for sampled digital audio.</p>`,
    viz:visuals.IntroViz
  },
  {
    kicker:"02 · Audio waves", title:"Sound is air pressure moving", short:"Audio wave",
    intuition:`Audio is a pressure wave travelling through air. When the pressure rises and falls smoothly, we hear a tone. The <b>frequency</b> controls pitch, while <b>amplitude</b> controls loudness. Try the wave shapes to hear how tone color changes too.`,
    takeaway:`A pure tone is the cleanest audio signal: one repeated wiggle over time.`,
    chips:["frequency = pitch","amplitude = loudness","wave shape = timbre"],
    math:`<p>A sinusoid is written as $$x(t)=A\\sin(2\\pi f t+\\varphi).$$</p><p>$A$ is amplitude, $f$ is frequency, and $\\varphi$ is phase. Digital audio stores samples of this curve.</p>`,
    viz:visuals.WaveViz
  },
  {
    kicker:"03 · Sampling", title:"Digital audio is snapshots in time", short:"Sampling rate",
    intuition:`A computer cannot store an infinitely smooth wave. It takes many <b>snapshots per second</b>. With enough snapshots, the dots trace the original wave. With too few, fast wiggles hide between dots and a false slower wave appears.`,
    takeaway:`The sample rate controls horizontal detail: how often the signal is measured.`,
    chips:["sample rate","Nyquist limit","aliasing"],
    math:`<p>A signal sampled at $f_s$ samples per second can represent frequencies below the Nyquist limit: $$f_\\text{max}=\\frac{f_s}{2}.$$</p><p>Frequencies above that fold back as aliases.</p>`,
    viz:visuals.SamplingViz
  },
  {
    kicker:"04 · Quantization", title:"Bit depth is height precision", short:"Bit depth",
    intuition:`Sampling chooses <b>when</b> to measure. Quantization chooses <b>which height</b> each measurement can use. Low bit depth gives the waveform chunky stair steps; high bit depth gives many more vertical levels and less rounding error.`,
    takeaway:`The notebook compares low-quality and high-quality digital signals: sample rate is x-axis detail, bit depth is y-axis detail.`,
    chips:["bit depth","rounding","noise"],
    math:`<p>With $b$ bits, the amplitude axis has $$2^b$$ possible levels.</p><p>The difference between the true wave height and the nearest available level is quantization error.</p>`,
    viz:visuals.QuantizationViz
  },
  {
    kicker:"05 · Frequency recipe", title:"Every sound is a stack of tones", short:"Fourier recipe",
    intuition:`Real sounds are not usually single tones. Fourier analysis says a complex wave can be described as a <b>recipe of simple sine waves</b>. The waveform shows what happens over time; the spectrum shows the ingredients.`,
    takeaway:`Move the ingredient sliders: changing the spectrum reshapes the wave immediately.`,
    chips:["DFT","FFT","spectrum"],
    math:`<p>The Discrete Fourier Transform converts $N$ samples into frequency coefficients:</p><p>$$X_k=\\sum_{n=0}^{N-1}x_n e^{-i2\\pi kn/N}.$$</p><p>The magnitude $|X_k|$ tells how much of frequency $k$ is present.</p>`,
    viz:visuals.SpectrumViz
  },
  {
    kicker:"06 · Windowing", title:"Spectrograms need small slices", short:"Windowing",
    intuition:`Music and speech change over time, so one spectrum for the whole clip is too blurry. Windowing cuts audio into short, overlapping frames. Each frame is short enough that the sound is nearly stable, and each frame becomes one column in a spectrogram.`,
    takeaway:`Short windows improve timing detail; longer windows improve frequency detail. There is always a tradeoff.`,
    chips:["frames","overlap","STFT"],
    math:`<p>The Short-Time Fourier Transform applies a window $w$ around each moment:</p><p>$$\\text{STFT}(m,k)=\\sum_n x[n]w[n-m]e^{-i2\\pi kn/N}.$$</p>`,
    viz:visuals.WindowViz
  },
  {
    kicker:"07 · Spectrogram", title:"See frequency change over time", short:"Spectrogram lab",
    intuition:`A spectrogram stacks many spectra side by side. Time runs left to right, frequency rises upward, and brightness means energy. Page 7 now opens a dedicated lab with three reliable source modes: generated sweep, uploaded audio, and microphone.`,
    takeaway:`Use the spectrogram lab for the actual display: upload uses the Python/librosa API with browser fallback, while sweep and mic use live Canvas/Web Audio drawing.`,
    chips:["time","frequency","energy"],
    math:`<p>Most spectrograms display power in decibels:</p><p>$$S_\\text{dB}=20\\log_{10}|\\text{STFT}|.$$</p><p>Brighter colors mean larger magnitude in that time-frequency cell.</p>`,
    viz:visuals.SpectrogramViz
  },
  {
    kicker:"08 · Mel scale", title:"Our ears do not hear frequency linearly", short:"Mel scale",
    intuition:`Humans notice small frequency differences more easily at low frequencies than at high frequencies. The mel scale bends Hertz into a pitch scale that better matches hearing, which is why mel spectrograms are common in audio machine learning.`,
    takeaway:`The notebook formula turns Hertz into Mels and explains why equal Hertz gaps do not always feel equally far apart.`,
    chips:["Hertz","Mels","perception"],
    math:`<p>A common conversion is:</p><p>$$m=2595\\log_{10}\\left(1+\\frac{f}{700}\\right).$$</p><p>The curve grows quickly at first, then flattens for high frequencies.</p>`,
    viz:visuals.MelViz
  },
  {
    kicker:"09 · Reading sounds", title:"Spectrogram patterns tell stories", short:"Gallery",
    intuition:`Once you know the axes, spectrograms become readable pictures. A pure tone is a flat stripe. Two tones are two stripes. A chirp is a diagonal. Percussion is a burst. Voice and birdsong show moving harmonic curves.`,
    takeaway:`This gallery mirrors the notebook examples: pure tone, two tones, chirp, percussion, instruments, birdsong, and voice.`,
    chips:["tone","chirp","percussion","voice"],
    math:`<p>Harmonic sounds place energy near integer multiples of a fundamental frequency: $$f_k=kf_0.$$</p><p>Transient sounds are sharp in time and spread across frequency, which is one reason drums look like vertical streaks.</p>`,
    viz:visuals.GalleryViz
  }
];

  window.AudioTutorial.STEPS = STEPS;
})();
