module.exports = {
  testEnvironment: 'node',
  // The pg pool keeps a TCP connection open by design (it is a connection pool).
  // Tests have no shutdown hook, so force Jest to exit after the run instead of
  // hanging on the pool's TCPWRAP handle. --detectOpenHandles confirms the pool
  // is the only open handle.
  forceExit: true,
};