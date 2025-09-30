const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const TurndownService = require('turndown');
const archiver = require('archiver');
const util = require('util');
const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);

/**
 * SplitDoctor service - Split Word documents based on Heading 1 styles (#)
 */
class SplitDoctorService {
  constructor() {
    // Initialize turndown for HTML to Markdown conversion
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    // Configure turndown to handle tables correctly
    this.configTurndownForTables();
    
    // Configure turndown to handle images as placeholders
    this.configTurndownForImages();
    
    // Configure turndown to handle text alignment
    this.configTextAlignment();
  }
  
  /**
   * Configure Turndown to handle images as placeholders
   */
  configTurndownForImages() {
    // Replace images with placeholder text
    this.turndownService.addRule('image', {
      filter: ['img'],
      replacement: function(content, node) {
        const alt = node.getAttribute('alt') || 'Image';
        return `[PLACEHOLDER: ${alt}]`;
      }
    });
    
    // Handle figure elements with captions
    this.turndownService.addRule('figure', {
      filter: 'figure',
      replacement: function(content, node) {
        // Find the image in the figure
        const img = node.querySelector('img');
        if (img) {
          const alt = img.getAttribute('alt') || 'Image';
          return `[PLACEHOLDER: ${alt}]`;
        }
        return '';
      }
    });
    
    // Prevent figcaption from being processed
    this.turndownService.addRule('figcaption', {
      filter: 'figcaption',
      replacement: function() {
        // Return empty string to remove the caption
        return '';
      }
    });
    
    // Also handle divs or other elements containing image captions
    this.turndownService.addRule('imageCaption', {
      filter: function(node) {
        // Look for elements that might be image captions
        return node.textContent && 
               node.textContent.trim() === (
                 node.previousElementSibling && 
                 node.previousElementSibling.querySelector('img') && 
                 node.previousElementSibling.querySelector('img').getAttribute('alt')
               );
      },
      replacement: function() {
        // Return empty string to remove duplicate captions
        return '';
      }
    });
  }
  
  /**
   * Configure Turndown to handle text alignment
   */
  configTextAlignment() {
    // Handle center-aligned text
    this.turndownService.addRule('centeredText', {
      filter: function(node) {
        // Match elements with 'text-align: center' or 'center' classes
        const style = node.getAttribute('style') || '';
        const className = node.getAttribute('class') || '';
        const tagName = node.tagName.toLowerCase();
        const align = node.getAttribute('align') || '';
        
        return (style.includes('text-align: center') || 
                style.includes('text-align:center') ||
                className.includes('center') ||
                align === 'center' ||
                tagName === 'center');
      },
      replacement: function(content, node) {
        // Skip if the content is empty or only whitespace
        if (!content.trim()) return '';
        
        // Add the markdown alignment syntax
        return `::: {.center}\n${content}\n:::\n`;
      }
    });
    
    // Handle right-aligned text
    this.turndownService.addRule('rightText', {
      filter: function(node) {
        // Match elements with 'text-align: right' or 'right' classes
        const style = node.getAttribute('style') || '';
        const className = node.getAttribute('class') || '';
        const align = node.getAttribute('align') || '';
        
        return (style.includes('text-align: right') || 
                style.includes('text-align:right') ||
                className.includes('right') ||
                align === 'right');
      },
      replacement: function(content, node) {
        // Skip if the content is empty or only whitespace
        if (!content.trim()) return '';
        
        // Add the markdown alignment syntax
        return `::: {.right}\n${content}\n:::\n`;
      }
    });
  }
  
  /**
   * Configure Turndown to handle tables with pipe formatting
   */
  configTurndownForTables() {
    // Add rules for table conversion to pipe-formatted Markdown
    this.turndownService.addRule('tableCell', {
      filter: ['th', 'td'],
      replacement: function(content, node) {
        return cell(content, node);
      }
    });
    
    this.turndownService.addRule('table', {
      filter: function(node) {
        return node.nodeName === 'TABLE';
      },
      replacement: function(content, node) {
        // If the table has no rows, don't process it
        const rows = node.rows;
        if (rows.length === 0) return '';
        
        let output = [];
        
        // Process each row
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const cells = row.cells;
          const rowContent = [];
          
          // Process each cell in the row
          for (let j = 0; j < cells.length; j++) {
            rowContent.push(cells[j].textContent.trim());
          }
          
          // Add the row to output
          output.push(`| ${rowContent.join(' | ')} |`);
          
          // Add separator row after header
          if (i === 0) {
            output.push(`| ${Array(cells.length).fill('---').join(' | ')} |`);
          }
        }
        
        return output.join('\n') + '\n\n';
      }
    });
    
    function cell(content, node) {
      // Strip new lines and excessive whitespace
      const trimmedContent = content.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
      return trimmedContent;
    }
  }
  
  /**
   * Process a Word document and split by Heading 1
   * @param {string} filePath - Path to the uploaded .docx file
   * @param {string} userId - User ID for organizing output files
   * @returns {Promise<Object>} - Paths to the zip files
   */
  async processDocument(filePath, userId) {
    try {
      // Create output directories in temp folder
      const timestamp = Date.now();
      const baseDir = path.join(__dirname, '../../temp', timestamp.toString());
      const mdDir = path.join(baseDir, 'markdown');
      
      await mkdir(baseDir, { recursive: true });
      await mkdir(mdDir, { recursive: true });
      
      // Define a custom transform function to detect paragraph alignment
      const transformElement = (element) => {
        // Only process paragraph elements
        if (element.type !== "paragraph") {
          return element;
        }
        
        // Check if this paragraph has alignment properties in the Word styles
        if (element.alignment === "center") {
          return {
            ...element,
            styleName: "center",
            attributes: { 
              ...element.attributes,
              style: "text-align: center;"
            }
          };
        } else if (element.alignment === "right") {
          return {
            ...element,
            styleName: "right",
            attributes: { 
              ...element.attributes,
              style: "text-align: right;"
            }
          };
        }
        
        // Also check for style name hints about alignment
        if (element.styleName) {
          const styleName = element.styleName.toLowerCase();
          if (styleName.includes('center') || styleName.includes('title')) {
            return {
              ...element,
              styleName: "center",
              attributes: { 
                ...element.attributes,
                style: "text-align: center;"
              }
            };
          }
          if (styleName.includes('right')) {
            return {
              ...element,
              styleName: "right",
              attributes: { 
                ...element.attributes,
                style: "text-align: right;"
              }
            };
          }
        }
        
        return element;
      };
      
      // Convert DOCX to HTML using mammoth with enhanced style preservation
      const { value: html } = await mammoth.convertToHtml({ 
        path: filePath,
        transformDocument: transformElement,
        styleMap: [
          "p[style-name='center'] => p[style='text-align: center;']",
          "p[style-name='right'] => p[style='text-align: right;']",
          "p[style-name='Center'] => p[style='text-align: center;']",
          "p[style-name='Right'] => p[style='text-align: right;']",
          "p[style-name*='center'] => p[style='text-align: center;']",
          "p[style-name*='Center'] => p[style='text-align: center;']",
          "p[style-name='Centered'] => p[style='text-align: center;']",
          "p[style-name='Title'] => p[style='text-align: center;']"
        ],
        includeDefaultStyleMap: true
      });
      
      // Convert HTML to Markdown
      const markdown = this.turndownService.turndown(html);
      
      // Split markdown by # headings
      const sections = this.splitMarkdownByHeadings(markdown);
      
      console.log(`Found ${sections.length} Heading 1 sections`);
      
      if (sections.length === 0) {
        throw new Error('No Heading 1 styles found in the document');
      }
      
      // Save each section as a separate markdown file
      const markdownFiles = [];
      
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const sectionNum = i + 1;
        const safeTitle = this.sanitizeFilename(section.title);
        
        // Create markdown file
        const mdPath = path.join(mdDir, `section${sectionNum}_${safeTitle}.md`);
        await writeFile(mdPath, section.content);
        markdownFiles.push(mdPath);
      }
      
      // Create ZIP file for markdown
      const mdZipPath = path.join(baseDir, 'markdown.zip');
      await this.createZipFile(mdDir, mdZipPath);
      
      // Return download path using the public-files endpoint
      const outputDirName = path.basename(baseDir);
      
      return {
        mdZipPath: `/public-files/${outputDirName}/markdown.zip`,
        sectionCount: sections.length,
        outputDir: outputDirName
      };
    } catch (error) {
      console.error('Error in SplitDoctor service:', error);
      throw error;
    }
  }
  
  /**
   * Split markdown content by level 1 headings
   * @param {string} markdown - Markdown content
   * @returns {Array} - Array of { title, content } objects
   */
  splitMarkdownByHeadings(markdown) {
    const lines = markdown.split('\n');
    const sections = [];
    let currentSection = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line is a level 1 heading
      if (line.startsWith('# ')) {
        // If we already have a section, save it
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start a new section
        const title = line.substring(2).trim();
        currentSection = {
          title,
          content: line + '\n' // Start with the heading
        };
      } else if (currentSection) {
        // Add this line to the current section
        currentSection.content += line + '\n';
      } else if (line.trim() !== '') {
        // If we have content before any heading, create a section for it
        currentSection = {
          title: 'Introduction',
          content: '# Introduction\n' + line + '\n'
        };
      }
    }
    
    // Don't forget the last section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }
  
  /**
   * Create a zip file from a directory
   * @param {string} sourceDir - Source directory
   * @param {string} outputPath - Output zip file path
   * @returns {Promise<void>}
   */
  async createZipFile(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Compression level
      });
      
      output.on('close', () => {
        resolve();
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      archive.pipe(output);
      
      // Add all files from the source directory
      archive.directory(sourceDir, false);
      
      archive.finalize();
    });
  }
  
  /**
   * Sanitize a filename
   * @param {string} filename - Original filename
   * @returns {string} - Sanitized filename
   */
  sanitizeFilename(filename) {
    return filename
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 50); // Limit length
  }
  
  /**
   * Apply direct alignment markers to specific patterns in markdown
   * @param {string} markdown - Original markdown content
   * @returns {string} - Enhanced markdown with direct alignment markers
   */
  enhanceMarkdownWithDirectAlignmentMarkers(markdown) {
    const lines = markdown.split('\n');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        result.push('');
        continue;
      }
      
      // Check for standalone short text (likely a name or title)
      if (line.split(' ').length <= 3 && 
          !line.includes('.') && !line.includes(':') && 
          !line.includes(',') && line.length < 30 && 
          !/^\d+\./.test(line) && // Not a numbered list
          !line.startsWith('#') && // Not a heading
          !line.startsWith('-') && // Not a list item
          !line.startsWith('*')) { // Not a list item
        
        // Check surrounding context
        const prevEmpty = i === 0 || !lines[i-1].trim();
        const nextEmpty = i === lines.length - 1 || !lines[i+1].trim();
        
        if (prevEmpty && nextEmpty) {
          // This is likely a standalone centered name or title
          result.push(`::: {.center}\n${line}\n:::`);
          continue;
        }
      }
      
      // Check for specific patterns that should be centered
      if (line.toUpperCase() === line || // ALL CAPS
          line.includes("Chapter") ||
          /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(line)) { // Name pattern
        result.push(`::: {.center}\n${line}\n:::`);
        continue;
      }
      
      // Default: keep the line unchanged
      result.push(line);
    }
    
    return result.join('\n');
  }
}

module.exports = new SplitDoctorService(); 