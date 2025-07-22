const splitDoctorService = require('../services/splitDoctor/splitDoctorService');
const fs = require('fs');
const util = require('util');
const unlinkFile = util.promisify(fs.unlink);

/**
 * Controller for SplitDoctor document processing
 */
class SplitDoctorController {
  /**
   * Process a DOCX file and split it into chapters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async splitDocument(req, res) {
    try {
      // Check if file is uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Get file path and check file type
      const filePath = req.file.path;
      if (!filePath.toLowerCase().endsWith('.docx')) {
        // Clean up the uploaded file
        try {
          await unlinkFile(filePath);
        } catch (err) {
          console.error('Error deleting uploaded file:', err);
        }
        
        return res.status(400).json({
          success: false,
          message: 'Only .docx files are supported'
        });
      }

      // Get user ID from authenticated user or use a default for testing
      const userId = req.user ? req.user.id : 'anonymous';

      // Process the document
      const result = await splitDoctorService.processDocument(filePath, userId);

      // Clean up the uploaded file
      try {
        await unlinkFile(filePath);
      } catch (err) {
        console.error('Error deleting uploaded file:', err);
      }

      // Return success response with download links
      return res.status(200).json({
        success: true,
        message: `Successfully split document into ${result.sectionCount} sections`,
        data: {
          sectionCount: result.sectionCount,
          mdZipPath: result.mdZipPath,
          outputDir: result.outputDir
        }
      });
    } catch (error) {
      console.error('Error in SplitDoctor controller:', error);
      
      // Clean up if there's an error
      if (req.file && req.file.path) {
        try {
          await unlinkFile(req.file.path);
        } catch (err) {
          console.error('Error deleting uploaded file:', err);
        }
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error processing document',
        error: error.message
      });
    }
  }
}

module.exports = new SplitDoctorController(); 