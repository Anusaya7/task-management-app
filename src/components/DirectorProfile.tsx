'use client'

import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, Calendar, Building, Shield, Save, Edit, X, Eye, EyeOff, Camera, Upload } from 'lucide-react';
import { Employee } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getEmployeeById, updateEmployee, createEmployee } from '../services/employeeService';

const DirectorProfile: React.FC = () => {
  const { user, login } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee & { 
    position?: string; 
    department?: string; 
    joiningDate?: string; 
    username?: string; 
    profilePicture?: string;
  }>>({});
  const [profilePicture, setProfilePicture] = useState<string>('');
  const [profilePicturePreview, setProfilePicturePreview] = useState<string>('');
  const [isFallbackData, setIsFallbackData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadEmployeeProfile = async () => {
      if (!user?.id) {
        console.error('âŒ User ID not found:', user);
        setError('User ID not found');
        setIsLoading(false);
        return;
      }

      try {
        console.log('ðŸ”„ Loading director profile for user ID:', user.id);
        // Pass email as fallback for non-ObjectId IDs (like mock users)
        const employeeData = await getEmployeeById(user.id, user.email);
        console.log('âœ… Director profile loaded:', employeeData);
        setEmployee(employeeData);
        const profilePic = (employeeData as any).profilePicture || (employeeData as any).avatar || '';
        setProfilePicture(profilePic);
        setProfilePicturePreview(profilePic);
        setFormData({
          firstName: employeeData.firstName,
          lastName: employeeData.lastName,
          email: employeeData.email,
          phone: employeeData.phone,
          position: (employeeData as any).position || employeeData.role,
          department: (employeeData as any).department || 'Management',
          joiningDate: (employeeData as any).joiningDate || '',
          status: employeeData.status,
          username: (employeeData as any).username || '',
          profilePicture: profilePic
        });
      } catch (err: any) {
        console.error('âŒ Error loading director profile:', err);
        
        // If employee not found (404), create a fallback employee object from user data
        if (err.response?.status === 404 || err.message?.includes('not found')) {
          console.log('âš ï¸ Employee not found in database, creating fallback from user data');
          setIsFallbackData(true);
          const nameParts = user.name?.split(' ') || ['', ''];
          const fallbackEmployee: any = {
            id: user.id,
            firstName: nameParts[0] || 'Director',
            lastName: nameParts.slice(1).join(' ') || 'User',
            email: user.email || '',
            phone: '',
            position: user.role || 'Director',
            department: 'Management',
            joiningDate: new Date().toISOString(),
            status: 'Active',
            username: user.email?.split('@')[0] || 'director',
            password: '',
            role: user.role as 'Director' | 'Project Head' | 'Employee'
          };
          
          setEmployee(fallbackEmployee);
          setFormData({
            firstName: fallbackEmployee.firstName,
            lastName: fallbackEmployee.lastName,
            email: fallbackEmployee.email,
            phone: fallbackEmployee.phone,
            position: fallbackEmployee.position,
            department: fallbackEmployee.department,
            joiningDate: fallbackEmployee.joiningDate,
            status: fallbackEmployee.status,
            username: fallbackEmployee.username,
            profilePicture: ''
          });
          setError(''); // Clear error since we have fallback data
        } else {
          setError(`Failed to load profile: ${err.response?.data?.message || err.message}`);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadEmployeeProfile();
  }, [user?.id]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        window.alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        window.alert('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfilePicture(base64String);
        setProfilePicturePreview(base64String);
        setFormData(prev => ({
          ...prev,
          profilePicture: base64String
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setProfilePicture('');
    setProfilePicturePreview('');
    setFormData(prev => ({
      ...prev,
      profilePicture: ''
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!employee?.id && !employee?._id) {
      window.alert('Employee ID not found');
      return;
    }

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.position) {
      window.alert('Please fill in all required fields (First Name, Last Name, Email, Phone, and Designation)');
      return;
    }

    try {
      setSaving(true);
      const employeeId = employee?.id || employee?._id || '';
      // Include profile picture in update data
      const updateData = {
        ...formData,
        profilePicture: profilePicture || formData.profilePicture,
        role: user?.role || employee?.role || 'Director'
      };
      
      let savedEmployee;
      
      // Try to update first
      try {
        // Pass email as fallback for non-ObjectId IDs (like mock users)
        savedEmployee = await updateEmployee(employeeId, updateData, user?.email);
      } catch (updateErr: any) {
        // If update fails with 404, create new employee
        if (updateErr.response?.status === 404 || updateErr.message?.includes('not found')) {
          console.log('âš ï¸ Employee not found, creating new employee record');
          // Create new employee with required fields
          const newEmployeeData = {
            firstName: formData.firstName!,
            lastName: formData.lastName!,
            email: formData.email!,
            phone: formData.phone || '',
            position: formData.position || 'Director',
            department: formData.department || 'Management',
            joiningDate: formData.joiningDate || new Date().toISOString(),
            status: (formData.status === 'Absent' ? 'Absent' : formData.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Absent' | 'Inactive',
            username: formData.username || user?.email?.split('@')[0] || 'director',
            password: (employee as any)?.password || 'temp123', // Temporary password, should be changed
            role: (user?.role || 'Director') as 'Director' | 'Project Head' | 'Employee',
            profilePicture: profilePicture || formData.profilePicture || ''
          };
          savedEmployee = await createEmployee(newEmployeeData);
        } else {
          throw updateErr; // Re-throw if it's not a 404 error
        }
      }
      
      setEmployee(savedEmployee);
      const savedProfilePic = (savedEmployee as any).profilePicture || (savedEmployee as any).avatar || '';
      setProfilePicture(savedProfilePic);
      setProfilePicturePreview(savedProfilePic);
      setIsFallbackData(false); // Reset fallback flag since we now have a real employee record
      setIsEditing(false);
      
      // Update user in context if name or email changed
      if (formData.firstName && formData.lastName) {
        const updatedUser = {
          ...user!,
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email || user!.email
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        // Note: We can't directly update the context user, but the next login will reflect changes
      }
      
      window.alert('Profile saved successfully!');
    } catch (err: any) {
      console.error('âŒ Error saving profile:', err);
      window.alert(`Failed to save profile: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (employee) {
      const profilePic = (employee as any).profilePicture || (employee as any).avatar || '';
      setProfilePicture(profilePic);
      setProfilePicturePreview(profilePic);
      const empAny = employee as any;
      setFormData({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: empAny.phone || '',
        position: empAny.position || '',
        department: empAny.department || '',
        joiningDate: empAny.joiningDate || '',
        status: employee.status,
        username: empAny.username || '',
        profilePicture: profilePic
      });
    }
    setIsEditing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '256px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '2px solid #e5e7eb',
          borderTop: '2px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{
            flexShrink: 0
          }}>
            <Shield style={{ height: '24px', width: '24px', color: '#f87171' }} />
          </div>
          <div style={{
            marginLeft: '12px'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#991b1b',
              margin: 0
            }}>Error Loading Profile</h3>
            <div style={{
              marginTop: '8px',
              fontSize: '14px',
              color: '#b91c1c'
            }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div style={{
        backgroundColor: '#fffbeb',
        border: '1px solid #fed7aa',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{
            flexShrink: 0
          }}>
            <User style={{ height: '24px', width: '24px', color: '#fbbf24' }} />
          </div>
          <div style={{
            marginLeft: '12px'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#92400e',
              margin: 0
            }}>Profile Not Found</h3>
            <div style={{
              marginTop: '8px',
              fontSize: '14px',
              color: '#b45309'
            }}>Unable to load your profile.</div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: Employee['status']) => {
    switch (status) {
      case 'Active': return { backgroundColor: '#dcfce7', color: '#166534' };
      case 'Inactive': return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'Absent': return { backgroundColor: '#fef3c7', color: '#92400e' };
      default: return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const empAny = employee as any;
  const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Director';
  const initials = `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}`.toUpperCase() || 'D';
  const avatarSrc = profilePicturePreview || profilePicture;
  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15';

  const renderField = (
    label: string,
    icon: React.ReactNode,
    value: React.ReactNode,
    editor?: React.ReactNode
  ) => (
    <div className="group rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-indigo-100 hover:bg-white hover:shadow-sm">
      <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100">
          {icon}
        </span>
        {label}
      </p>
      {isEditing && editor ? editor : (
        <div className="break-words pl-8 text-[15px] font-semibold text-slate-900">{value}</div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#172554] via-[#1E40AF] to-[#7C3AED] shadow-xl shadow-indigo-900/20">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl" />

        <div className="relative flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <div className="relative flex-shrink-0">
              <div className="h-28 w-28 overflow-hidden rounded-full bg-gradient-to-br from-amber-300 via-pink-400 to-violet-500 p-[3px] shadow-lg">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#172554]">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black tracking-wide text-white">{initials}</span>
                  )}
                </div>
              </div>
              {isEditing && (
                <div className="absolute -bottom-1 -right-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-md transition hover:bg-indigo-700"
                    title="Upload Photo"
                  >
                    <Camera size={16} />
                  </button>
                  {avatarSrc && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-white shadow-md transition hover:bg-rose-600"
                      title="Remove Photo"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">My Profile</p>
              <h1 className="mt-1 break-words text-3xl font-black text-white">{fullName}</h1>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur">
                  <Shield size={13} />
                  {empAny.position || employee.role}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/90 px-3 py-1 text-xs font-bold text-amber-950">
                  <Building size={13} />
                  {empAny.department || 'Management'}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  employee.status === 'Active'
                    ? 'bg-emerald-400/90 text-emerald-950'
                    : employee.status === 'Absent'
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-rose-300 text-rose-950'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {employee.status}
                </span>
              </div>
              <p className="mt-3 flex items-center justify-center gap-1.5 break-all text-sm text-indigo-100 sm:justify-start">
                <Mail size={14} className="flex-shrink-0" />
                {employee.email}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center justify-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-50"
              >
                <Edit size={16} />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/30 transition hover:bg-white/25 disabled:opacity-50"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-emerald-950 shadow-lg transition hover:bg-emerald-300 disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {isFallbackData && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <Shield size={20} className="mt-0.5 flex-shrink-0 text-amber-700" />
          <div>
            <h3 className="text-sm font-bold text-amber-900">Profile Not Found in Database</h3>
            <p className="mt-0.5 text-[13px] text-amber-800">
              Your profile information is being loaded from your account. Please fill in your details and save to create your employee profile in the system.
            </p>
          </div>
        </div>
      )}

      {isEditing && (
        <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-800">
          Use the camera icon on your photo to upload a new profile picture (max 5MB). Fields marked * are required.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal Information */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-white px-6 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/30">
              <User size={19} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900">Personal Information</h2>
              <p className="text-xs text-slate-500">Your name and contact details</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            {renderField('First Name *', <User size={13} />, employee.firstName, (
              <input type="text" value={formData.firstName || ''} onChange={(e) => handleInputChange('firstName', e.target.value)} className={inputClass} required />
            ))}
            {renderField('Last Name *', <User size={13} />, employee.lastName, (
              <input type="text" value={formData.lastName || ''} onChange={(e) => handleInputChange('lastName', e.target.value)} className={inputClass} required />
            ))}
            {renderField('Email Address *', <Mail size={13} />, employee.email, (
              <input type="email" value={formData.email || ''} onChange={(e) => handleInputChange('email', e.target.value)} className={inputClass} required />
            ))}
            {renderField('Phone Number *', <Phone size={13} />, empAny.phone || 'N/A', (
              <input type="tel" value={formData.phone || ''} onChange={(e) => handleInputChange('phone', e.target.value)} className={inputClass} required />
            ))}
          </div>
        </div>

        {/* Work Information */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-white px-6 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/30">
              <Building size={19} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900">Work Information</h2>
              <p className="text-xs text-slate-500">Role, department and account</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            {renderField('Designation *', <Shield size={13} />, empAny.position || employee.role, (
              <input type="text" value={formData.position || ''} onChange={(e) => handleInputChange('position', e.target.value)} className={inputClass} placeholder="Enter your designation" required />
            ))}
            {renderField('Department', <Building size={13} />, empAny.department || 'Management')}
            {renderField('Joining Date', <Calendar size={13} />, formatDate(empAny.joiningDate || new Date().toISOString()))}
            {renderField('Status', <Shield size={13} />, (
              <span className="inline-flex rounded-full px-3 py-0.5 text-xs font-bold" style={getStatusColor(employee.status)}>
                {employee.status}
              </span>
            ))}
            {renderField('Username', <User size={13} />, empAny.username || employee.email.split('@')[0])}
            {renderField('Role', <Shield size={13} />, employee.role)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectorProfile;

