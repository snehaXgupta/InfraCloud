const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    passwordHash: {
      type: String,
      required: [true, 'Please provide a password'],
      select: false,
    },
    role: {
      type: String,
      enum: [
        'Platform Admin',
        'DevOps / Infrastructure',
        'Project Admin',
        'Client Admin',
        'Client Viewer',
        'Auditor',
        'Billing / Finance',
      ],
      default: 'Client Viewer',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'pending'],
      default: 'active',
    },
    avatar: {
      type: String,
      default: '',
    },
    assignedClients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
      },
    ],
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) {
    return;
  }
  // If already bcrypt hashed, skip
  if (this.passwordHash.startsWith('$2a$') || this.passwordHash.startsWith('$2b$')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

module.exports = mongoose.model('User', userSchema);
