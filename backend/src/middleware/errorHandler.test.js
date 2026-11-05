const { notFound, errorHandler } = require('./errorHandler');

describe('Error middleware', () => {
  let req;
  let res;
  let next;
  let consoleSpy;

  beforeEach(() => {
    req = { id: 'REQ-001' };
    res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('returns 404 for an unknown route', () => {
    notFound(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        requestId: 'REQ-001'
      }
    });
  });

  test('returns a custom application error', () => {
    const err = {
      status: 400,
      code: 'VALIDATION_ERROR',
      publicMessage: 'Invalid input',
      stack: 'Test stack'
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        requestId: 'REQ-001'
      }
    });
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('uses default values for an ordinary error', () => {
    const err = new Error('Database failure');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: 'REQ-001'
      }
    });
  });

  test('uses the error message when stack is unavailable', () => {
    const err = { message: 'Simple error' };

    errorHandler(err, req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith('[REQ-001]', 'Simple error');
  });

  test('does not send a response when headers are already sent', () => {
    res.headersSent = true;

    errorHandler(new Error('Already sent'), req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
