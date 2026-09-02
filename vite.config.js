export default {
  root: '.',
  server: { open: '/Liron.dc.html', host: true },
  plugins: [{
    name: 'redirect-root-to-card',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/') { res.writeHead(302, { Location: '/Liron.dc.html' }); res.end(); return; }
        next();
      });
    }
  }]
};
