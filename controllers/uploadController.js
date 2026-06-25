export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // multer-storage-cloudinary attaches the Cloudinary URL to req.file.path
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      url: req.file.path,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
