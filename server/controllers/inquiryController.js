import appDb from '../config/database.js'

export const inquiryController = {
  async getAllInquiries(req, res) {
    try {
      const inquiries = await appDb.getInquiries()
      return res.status(200).json({
        success: true,
        count: inquiries.length,
        inquiries,
      })
    } catch (err) {
      console.error('[InquiryController getAllInquiries Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch customer inquiries.',
      })
    }
  },

  async createInquiry(req, res) {
    try {
      const data = req.body || {}
      if (!data.name || !data.phone) {
        return res.status(400).json({
          success: false,
          message: 'Customer name and phone number are required.',
        })
      }

      const newInquiry = await appDb.createInquiry(data)

      return res.status(201).json({
        success: true,
        message: 'Inquiry registered successfully.',
        inquiry: newInquiry,
      })
    } catch (err) {
      console.error('[InquiryController createInquiry Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to register customer inquiry.',
      })
    }
  },

  async updateInquiry(req, res) {
    try {
      const { id } = req.params
      const updatedInquiry = await appDb.updateInquiry(id, req.body)

      if (!updatedInquiry) {
        return res.status(404).json({
          success: false,
          message: `Inquiry with ID ${id} not found.`,
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Inquiry updated successfully.',
        inquiry: updatedInquiry,
      })
    } catch (err) {
      console.error('[InquiryController updateInquiry Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to update customer inquiry.',
      })
    }
  },

  async deleteInquiry(req, res) {
    try {
      const { id } = req.params
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Inquiry ID is required.',
        })
      }

      const deletedInquiry = await appDb.deleteInquiry(id)
      if (!deletedInquiry) {
        return res.status(404).json({
          success: false,
          message: `Inquiry with ID ${id} not found or already deleted.`,
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Inquiry permanently deleted.',
        deletedId: id,
        inquiry: deletedInquiry,
      })
    } catch (err) {
      console.error('[InquiryController deleteInquiry Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to delete customer inquiry.',
      })
    }
  },

  async resetInquiries(req, res) {
    try {
      await appDb.resetInquiries()
      return res.status(200).json({
        success: true,
        message: 'Customer inquiries completely reset to 0 leads.',
        inquiries: [],
      })
    } catch (err) {
      console.error('[InquiryController resetInquiries Error]:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to reset customer inquiries.',
      })
    }
  },
}

export default inquiryController
