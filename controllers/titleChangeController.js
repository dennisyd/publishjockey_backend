const TitleChangeRequest = require('../models/TitleChangeRequest');
const Project = require('../models/Project');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { sendNotificationEmail } = require('../utils/emailUtils');

function levenshtein(a, b) {
  if (a === b) return 0;
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = new Array(bn + 1);
  for (let i = 0; i <= bn; ++i) matrix[i] = [i];
  for (let j = 0; j <= an; ++j) matrix[0][j] = j;
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[bn][an];
}

function diffPercent(s1, s2) {
  const a = (s1 || '').trim().toLowerCase();
  const b = (s2 || '').trim().toLowerCase();
  if (!a && !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return Math.round((dist / maxLen) * 100);
}

exports.list = async (req, res) => {
  try {
    const { status, userId, projectId, from, to } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    if (projectId) filter.projectId = projectId;
    if (from || to) {
      filter.requestedAt = {};
      if (from) filter.requestedAt.$gte = new Date(from);
      if (to) filter.requestedAt.$lte = new Date(to);
    }
    const items = await TitleChangeRequest.find(filter).sort({ requestedAt: -1 }).limit(200).lean();
    res.json({ success: true, items });
  } catch (e) {
    console.error('Title change list error', e);
    res.status(500).json({ success: false, message: 'Failed to list requests' });
  }
};

exports.approve = async (req, res) => {
  try {
    const { id } = req.params;
    const reqItem = await TitleChangeRequest.findById(id);
    if (!reqItem || reqItem.status !== 'Pending') return res.status(404).json({ success: false, message: 'Request not found' });
    const project = await Project.findById(reqItem.projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    project.title = reqItem.newTitle;
    await project.save();
    reqItem.status = 'Approved';
    reqItem.decidedAt = new Date();
    reqItem.decidedBy = req.user.userId;
    await reqItem.save();
    await AuditLog.create({ action: 'TITLE_CHANGE_APPROVE', performedBy: req.user.userId, targetUser: reqItem.userId, details: { requestId: id } });
    // Notify user (best-effort)
    const user = await User.findById(reqItem.userId);
    if (user) {
      await sendNotificationEmail({ name: user.name, email: user.email, subject: 'Your title change has been approved', message: `Your new title is now live: "${reqItem.newTitle}"` }).catch(()=>{});
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Title change approve error', e);
    res.status(500).json({ success: false, message: 'Failed to approve request' });
  }
};

exports.deny = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reqItem = await TitleChangeRequest.findById(id);
    if (!reqItem || reqItem.status !== 'Pending') return res.status(404).json({ success: false, message: 'Request not found' });
    reqItem.status = 'Denied';
    reqItem.decidedAt = new Date();
    reqItem.decidedBy = req.user.userId;
    reqItem.denialReason = reason || 'Not approved';
    await reqItem.save();
    await AuditLog.create({ action: 'TITLE_CHANGE_DENY', performedBy: req.user.userId, targetUser: reqItem.userId, details: { requestId: id, reason: reqItem.denialReason } });
    const user = await User.findById(reqItem.userId);
    if (user) {
      await sendNotificationEmail({ name: user.name, email: user.email, subject: 'Your title change could not be approved', message: `We couldn’t approve your recent title change request. Please keep your last approved title.` }).catch(()=>{});
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Title change deny error', e);
    res.status(500).json({ success: false, message: 'Failed to deny request' });
  }
};

exports.flagIfNeeded = async ({ user, project, newTitle }) => {
  try {
    // Multi-book plans exempt
    const singlePlans = new Set(['single', 'single_promo']);
    if (!singlePlans.has(user.subscription)) return;
    // 3-day window
    const created = project.createdAt || project.created_at || new Date();
    const ageMs = Date.now() - new Date(created).getTime();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    if (ageMs <= threeDays) return;
    const oldTitle = project.title || '';
    const delta = diffPercent(oldTitle, newTitle);
    if (delta < 25) return;
    const pending = await TitleChangeRequest.findOne({ projectId: project._id, status: 'Pending' });
    if (pending) {
      pending.newTitle = newTitle;
      pending.similarityDelta = delta;
      pending.requestedAt = new Date();
      await pending.save();
      return;
    }
    const item = await TitleChangeRequest.create({
      userId: user._id,
      projectId: project._id,
      oldTitle,
      newTitle,
      similarityDelta: delta,
      triggerReason: '>25% after 3 days',
      status: 'Pending',
      requestedAt: new Date()
    });
    // TODO: notify admins via email or dashboard badge
    console.log('Title change flagged:', item._id.toString());
  } catch (e) {
    console.error('Title change flag error', e);
  }
};


