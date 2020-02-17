this.DOMAIN = 'api.dev.y-bi.top'
var site_host_http = "https://xxx";

// create the HTTP proxy server.
var http_proxy = httpProxy.createProxyServer({
  target: site_host_http, ws:true
});

// listen to error
http_proxy.on('error', function (err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });

  res.end('Something went wrong. And we are reporting a custom error message.');
});

function main(req, res) {
  // http(s) requests.
  http_proxy.web(req, res, function (err) {
      console.log(err.stack);
      res.writeHead(502);
      res.end("There was an error. Please try again");
  });
  
  // websocket requests.
  req.on('upgrade', function (req, socket, head) {
    proxy.ws(req, socket, head, function (err) {
      console.log(err.stack);
      socket.close();
    });
  });
}
