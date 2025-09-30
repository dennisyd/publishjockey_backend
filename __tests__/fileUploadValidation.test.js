const request = require('supertest');
const app = require('../server');
const path = require('path');

describe('File Upload Validation', () => {
  let authToken;

  beforeAll(async () => {
    // Get auth token for testing
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    if (loginResponse.body.token) {
      authToken = loginResponse.body.token;
    }
  });

  describe('Image Upload Size Limits', () => {
    it('should reject files larger than 15MB', async () => {
      // Create a mock large file (simulate 16MB)
      const largeBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB
      
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', largeBuffer, 'large-image.jpg')
        .expect(400);

      expect(response.body.error).toBe('File too large');
      expect(response.body.message).toContain('15MB limit');
      expect(response.body.maxSize).toBe('15MB');
    });

    it('should accept files smaller than 15MB', async () => {
      // Create a mock small file (1MB)
      const smallBuffer = Buffer.alloc(1 * 1024 * 1024); // 1MB
      
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', smallBuffer, 'small-image.jpg');

      // This might fail for other reasons (like Cloudinary), but shouldn't fail for size
      expect(response.status).not.toBe(400);
      if (response.status === 400) {
        expect(response.body.error).not.toBe('File too large');
      }
    });
  });

  describe('File Type Validation', () => {
    it('should reject non-image files', async () => {
      const textBuffer = Buffer.from('This is not an image');
      
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', textBuffer, 'document.txt')
        .expect(400);

      expect(response.body.error).toBe('Invalid file type');
      expect(response.body.allowedTypes).toContain('JPEG');
    });

    it('should accept valid image types', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', imageBuffer, 'test-image.jpg');

      // This might fail for other reasons, but shouldn't fail for file type
      expect(response.status).not.toBe(400);
      if (response.status === 400) {
        expect(response.body.error).not.toBe('Invalid file type');
      }
    });
  });

  describe('File Extension Validation', () => {
    it('should reject files with invalid extensions', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', imageBuffer, 'test-image.bmp')
        .expect(400);

      expect(response.body.error).toBe('Invalid file extension');
      expect(response.body.allowedExtensions).toContain('.jpg');
    });
  });

  describe('Error Handling', () => {
    it('should provide clear error messages for file size errors', async () => {
      const largeBuffer = Buffer.alloc(16 * 1024 * 1024);
      
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', largeBuffer, 'large-image.jpg')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('maxSize');
      expect(response.body.message).toContain('15MB');
    });

    it('should handle missing files gracefully', async () => {
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('No file uploaded');
      expect(response.body.message).toContain('Please select a file');
    });
  });
});
