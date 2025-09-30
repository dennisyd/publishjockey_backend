const fs = require('fs');
const path = require('path');

/**
 * Download a file
 * @param {Object} req - Request object with query params 'file' and 'dir'
 * @param {Object} res - Response object
 */
const downloadFile = (req, res) => {
  try {
    const { file, dir } = req.query;
    
    if (!file || !dir) {
      return res.status(400).json({
        success: false,
        message: 'Missing file or directory parameter'
      });
    }
    
    // Sanitize the file and dir parameters to prevent path traversal attacks
    const sanitizedDir = path.basename(dir);
    const sanitizedFile = path.basename(file);
    
    // Construct the file path
    const filePath = path.join(__dirname, '../temp', sanitizedDir, sanitizedFile);
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename=${sanitizedFile}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // Handle errors
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming file',
          error: error.message
        });
      }
    });
    
    // Optional: Clean up the file after download (uncomment if needed)
    // fileStream.on('close', () => {
    //   try {
    //     fs.unlinkSync(filePath);
    //   } catch (error) {
    //     console.error('Error cleaning up file:', error);
    //   }
    // });
  } catch (error) {
    console.error('Error in downloadFile:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing download',
      error: error.message
    });
  }
};

module.exports = {
  downloadFile
}; 