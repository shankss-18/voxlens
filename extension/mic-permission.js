navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    stream.getTracks().forEach(t => t.stop());
    window.close();
  })
  .catch(err => {
    console.error('Mic denied:', err);
    window.close();
  });
