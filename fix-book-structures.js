const mongoose = require('mongoose');
require('dotenv').config();

// Use the existing MongoDB connection from your backend
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/publishjockey';

// Define a simple Project schema for this script
const projectSchema = new mongoose.Schema({
  title: String,
  content: Object,
  structure: Object,
  owner: mongoose.Schema.Types.ObjectId,
  updatedAt: Date
}, { strict: false });

const Project = mongoose.model('Project', projectSchema);

async function reconstructBookStructures() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find all books that have content
    const books = await Project.find({ 
      content: { $exists: true, $ne: {} } 
    });
    
    console.log(`Found ${books.length} books with content`);
    
    for (const book of books) {
      console.log(`\n--- Processing: "${book.title}" ---`);
      
      const contentKeys = Object.keys(book.content || {});
      console.log(`Total content sections: ${contentKeys.length}`);
      
      // Analyze current structure
      const currentStructure = book.structure || { front: [], main: [], back: [] };
      const currentSectionCount = (currentStructure.front?.length || 0) + 
                                 (currentStructure.main?.length || 0) + 
                                 (currentStructure.back?.length || 0);
      
      console.log(`Current structure sections: ${currentSectionCount}`);
      
      // If content has more sections than structure, reconstruct
      if (contentKeys.length > currentSectionCount) {
        console.log(`🔧 Reconstructing structure (${contentKeys.length} > ${currentSectionCount})`);
        
        const newStructure = reconstructStructureFromContent(contentKeys, book.content);
        
        console.log('New structure:');
        console.log('  Front:', newStructure.front.join(', '));
        console.log('  Main:', newStructure.main.join(', '));
        console.log('  Back:', newStructure.back.join(', '));
        
        // Ask for confirmation before updating
        const shouldUpdate = await askForConfirmation(
          `Update "${book.title}" structure? (y/n): `
        );
        
        if (shouldUpdate) {
          await Project.updateOne(
            { _id: book._id },
            { 
              $set: { 
                structure: newStructure,
                updatedAt: new Date()
              }
            }
          );
          console.log('✅ Structure updated successfully!');
        } else {
          console.log('⏭️  Skipped');
        }
      } else {
        console.log('✅ Structure appears correct (no reconstruction needed)');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

function reconstructStructureFromContent(contentKeys, content) {
  const areas = { front: [], main: [], back: [] };
  
  // Categorize and collect sections
  contentKeys.forEach(key => {
    const [area, sectionName] = key.split(':');
    if (areas[area] && sectionName && content[key]?.trim()) {
      // Only include sections with actual content
      if (!areas[area].includes(sectionName)) {
        areas[area].push(sectionName);
      }
    }
  });
  
  // Sort sections in a logical order
  areas.front = sortFrontMatterSections(areas.front);
  areas.main = sortMainMatterSections(areas.main);
  areas.back = sortBackMatterSections(areas.back);
  
  return areas;
}

function sortFrontMatterSections(sections) {
  const preferredOrder = [
    'Title Page', 'Copyright', 'Dedication', 'Acknowledgments', 
    'Foreword', 'Preface', 'Introduction', 'Author Note', 'Disclaimer'
  ];
  
  const sorted = [];
  
  // Add sections in preferred order
  preferredOrder.forEach(preferred => {
    const found = sections.find(s => s === preferred);
    if (found) {
      sorted.push(found);
    }
  });
  
  // Add any remaining sections
  sections.forEach(section => {
    if (!sorted.includes(section)) {
      sorted.push(section);
    }
  });
  
  return sorted;
}

function sortMainMatterSections(sections) {
  const sorted = [];
  
  // Helper function to extract numbers from chapter/part names
  const extractNumber = (name) => {
    const match = name.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };
  
  // Helper function to extract roman numerals
  const extractRoman = (name) => {
    const romanMatch = name.match(/\b(I{1,3}|IV|V|VI{0,3}|IX|X)\b/);
    if (romanMatch) {
      const romanToNum = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10};
      return romanToNum[romanMatch[1]] || 0;
    }
    return 0;
  };
  
  // Separate parts and chapters
  const parts = sections.filter(s => s.toLowerCase().includes('part'));
  const chapters = sections.filter(s => s.toLowerCase().includes('chapter'));
  const others = sections.filter(s => 
    !s.toLowerCase().includes('part') && 
    !s.toLowerCase().includes('chapter')
  );
  
  // Sort parts by number or roman numeral
  parts.sort((a, b) => {
    const aNum = extractNumber(a) || extractRoman(a);
    const bNum = extractNumber(b) || extractRoman(b);
    return aNum - bNum;
  });
  
  // Sort chapters by number
  chapters.sort((a, b) => extractNumber(a) - extractNumber(b));
  
  // Interleave parts and chapters logically
  let partIndex = 0;
  let chapterIndex = 0;
  
  while (partIndex < parts.length || chapterIndex < chapters.length) {
    // Add part if available
    if (partIndex < parts.length) {
      sorted.push(parts[partIndex]);
      partIndex++;
    }
    
    // Add chapters (usually 3 per part, but flexible)
    let chaptersPerPart = Math.ceil(chapters.length / parts.length) || chapters.length;
    if (parts.length === 0) chaptersPerPart = chapters.length;
    
    for (let i = 0; i < chaptersPerPart && chapterIndex < chapters.length; i++) {
      sorted.push(chapters[chapterIndex]);
      chapterIndex++;
    }
  }
  
  // Add other sections at the end
  others.forEach(section => {
    if (!sorted.includes(section)) {
      sorted.push(section);
    }
  });
  
  return sorted;
}

function sortBackMatterSections(sections) {
  const preferredOrder = [
    'Conclusion', 'Epilogue', 'About the Author', 'Bonus', 
    'Appendix', 'References', 'Bibliography', 'Index', 'Glossary'
  ];
  
  const sorted = [];
  
  // Add sections in preferred order
  preferredOrder.forEach(preferred => {
    const found = sections.find(s => s === preferred);
    if (found) {
      sorted.push(found);
    }
  });
  
  // Add any remaining sections
  sections.forEach(section => {
    if (!sorted.includes(section)) {
      sorted.push(section);
    }
  });
  
  return sorted;
}

// Simple prompt function for CLI
function askForConfirmation(question) {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Run the script
if (require.main === module) {
  console.log('🔧 Book Structure Reconstruction Tool');
  console.log('=====================================');
  
  reconstructBookStructures()
    .then(() => {
      console.log('\n✅ Structure reconstruction complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { reconstructBookStructures };