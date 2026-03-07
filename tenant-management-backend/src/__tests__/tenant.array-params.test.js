/**
 * Test for array parameter handling bug fix
 * 
 * Ensures both ?status[]=active and ?status=active work correctly
 */

import { searchTenants } from '../modules/tenant/tenant.controller.js';

describe('Array Parameter Handling', () => {
  it('should handle bracket notation (status[])', async () => {
    const mockReq = {
      query: {
        'status[]': ['active'],  // How Express parses ?status[]=active
      },
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    await searchTenants(mockReq, mockRes);
    
    // Should normalize to 'status' (without brackets)
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalled();
    const response = mockRes.json.mock.calls[0][0];
    expect(response.success).toBe(true);
  });
  
  it('should handle repeated parameters', async () => {
    const mockReq = {
      query: {
        status: ['active', 'inactive'],  // How Express parses ?status=active&status=inactive
      },
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    await searchTenants(mockReq, mockRes);
    
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalled();
  });
  
  it('should handle mixed formats', async () => {
    const mockReq = {
      query: {
        'status[]': ['active'],
        frequency: 'monthly',
      },
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    await searchTenants(mockReq, mockRes);
    
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });
  
  it('should reject unknown parameters with brackets', async () => {
    const mockReq = {
      query: {
        'invalid[]': ['value'],
      },
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    await searchTenants(mockReq, mockRes);
    
    // Should return 400 for unknown param (after normalization)
    expect(mockRes.status).toHaveBeenCalledWith(400);
    const response = mockRes.json.mock.calls[0][0];
    expect(response.success).toBe(false);
    expect(response.message).toContain('Unknown query parameters');
  });
});
