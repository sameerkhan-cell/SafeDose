import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  User, Building2, MapPin, Phone, Mail, Globe, FileText, Calendar,
  Save, CheckCircle2, Shield, Pill, Clock, Package,
  AlertCircle, Loader2, Upload, Trash2, ImagePlus
} from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getStoredSession } from "@/services/auth";
import {
  manufacturerProfileService,
  type ManufacturerProfile,
} from "@/services/manufacturer-profile";
import { pharmacyService, type PharmacyProfile as PharmacyProfileType } from "@/services/pharmacy";
import { ComplianceDocuments } from "@/components/dashboard/manufacturer/ComplianceDocuments";
import { DASH_NAV } from "@/config/nav";
import { DashShell } from "@/components/dashboard/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ease } from "@/lib/motion";

export const Route = createFileRoute("/dashboard/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — MediVerify" },
      { name: "description", content: "Manage your MediVerify profile and business information." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return <Navigate to="/auth/login" />;

  const role = user.role;
  return (
    <DashShell title="My Profile" subtitle="Manage your account and business information" badge="Profile" nav={DASH_NAV}>
      {role === "manufacturer" ? <ManufacturerProfile /> : role === "pharmacy" ? <PharmacyProfile /> : <PatientProfile />}
    </DashShell>
  );
}

/* ─── Shared Field Component ─── */
function Field({ label, icon: Icon, value, onChange, type = "text", placeholder = "", required = false, error = "" }: {
  label: string; icon: typeof User; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; error?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label} {required && <span className="text-destructive">*</span>}
      </label>
      <Input value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder}
        className={`h-11 rounded-xl text-[14px] bg-secondary/20 ${error ? "border-destructive/50" : ""}`} />
      {error && <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
}

function TextArea({ label, icon: Icon, value, onChange, placeholder = "", rows = 3 }: {
  label: string; icon: typeof User; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-ring/50" />
    </div>
  );
}

function SaveButton({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <Button onClick={onSave} disabled={saving} className="rounded-xl bg-gradient-primary shadow-elegant text-[13px] font-medium transition-all hover:scale-[1.02] disabled:opacity-60">
      {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
    </Button>
  );
}

const EMPTY_MANUFACTURER_PROFILE: ManufacturerProfile = {
  companyName: "",
  companyLogo: "",
  businessLocation: "",
  address: "",
  contactNumber: "",
  officialEmail: "",
  drapLicense: "",
  industryType: "",
  productCategories: "",
  websiteUrl: "",
  manufacturingCapacity: "",
  certifications: "",
  operatingCountries: "",
  taxId: "",
  registrationNumber: "",
  registrationDate: "",
  companyDescription: "",
};

/* ─── MANUFACTURER PROFILE ─── */
function ManufacturerProfile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState<ManufacturerProfile>(EMPTY_MANUFACTURER_PROFILE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const u = (key: keyof ManufacturerProfile) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const handleLogoUpload = async (file: File) => {
    // Validate client-side too
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size exceeds 2MB limit.");
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Invalid format. Use PNG, JPG, JPEG, or WEBP.");
      return;
    }

    setLogoUploading(true);
    const res = await manufacturerProfileService.uploadLogo(file);
    setLogoUploading(false);

    if (res.success && res.data) {
      const newLogo = res.data.logoUrl;
      setForm(prev => ({ ...prev, companyLogo: newLogo }));
      updateUser({ companyLogo: newLogo, logoUrl: newLogo, avatar: newLogo });
      toast.success("Logo uploaded successfully.");
    } else {
      toast.error(res.error?.message ?? "Logo upload failed.");
    }
  };

  const handleLogoDelete = async () => {
    if (!confirm("Are you sure you want to remove the company logo?")) return;

    setLogoUploading(true);
    const res = await manufacturerProfileService.deleteLogo();
    setLogoUploading(false);

    if (res.success) {
      setForm(prev => ({ ...prev, companyLogo: "" }));
      updateUser({ companyLogo: "", logoUrl: "", avatar: "" });
      toast.success("Logo removed.");
    } else {
      toast.error(res.error?.message ?? "Failed to remove logo.");
    }
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await manufacturerProfileService.getProfile();
    if (res.success && res.data) {
      setForm(res.data);
      if (res.data.companyLogo) {
        updateUser({ companyLogo: res.data.companyLogo, logoUrl: res.data.companyLogo, avatar: res.data.companyLogo });
      }
    } else {
      setLoadError(res.error?.message ?? "Failed to load profile.");
    }
    setLoading(false);
  }, [updateUser]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    const session = localStorage.getItem("mediverify_session") || sessionStorage.getItem("mediverify_session");
    if (!session) return;
    try {
      const parsed = JSON.parse(session);
      const headers = { "Authorization": `Bearer ${parsed.token}` };
      fetch("/api/auth/me", { headers })
        .then(res => res.json())
        .then(res => {
          if (res.success && res.data) {
            updateUser({
              isVerified: res.data.isVerified,
              fullName: res.data.name,
            });
          }
        })
        .catch(err => console.error("Failed to sync user verification status:", err));
    } catch {}
  }, [updateUser, user]);

  const save = async () => {
    setSaving(true);
    const res = await manufacturerProfileService.updateProfile(form);
    setSaving(false);

    if (res.success && res.data) {
      setForm(res.data);
      updateUser({ fullName: res.data.companyName });
      toast.success("Profile updated", {
        description: "Your manufacturer profile has been saved.",
      });
      return;
    }

    toast.error(res.error?.message ?? "Failed to save profile.");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Loading your profile…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card-premium p-8 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-sm text-destructive">{loadError}</p>
        <Button onClick={() => void loadProfile()} variant="outline" className="rounded-xl">
          Try again
        </Button>
      </div>
    );
  }

  const badge = user?.isVerified ? "Verified" : "Unverified";

  return (
    <div className="space-y-6">
      <AvatarSection
        name={form.companyName || user?.fullName || "Manufacturer"}
        subtitle="Manufacturer Account"
        badge={badge}
        logoUrl={form.companyLogo}
        onLogoUpload={handleLogoUpload}
        onLogoDelete={handleLogoDelete}
        uploading={logoUploading}
      />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="card-premium p-6">
        <h3 className="text-[15px] font-semibold mb-5 flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Company Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company Name" icon={Building2} value={form.companyName} onChange={u("companyName")} required />
          <Field label="DRAP License #" icon={Shield} value={form.drapLicense} onChange={u("drapLicense")} required placeholder="DRAP-MFG-2024-001847" />
          <Field label="Tax ID" icon={FileText} value={form.taxId} onChange={u("taxId")} placeholder="e.g. NTN-1234567" required />
          <Field label="Registration Number" icon={FileText} value={form.registrationNumber} onChange={u("registrationNumber")} placeholder="e.g. SECP-2021-0012345" required />
          <Field label="Business Location" icon={MapPin} value={form.businessLocation} onChange={u("businessLocation")} />
          <Field label="Full Address" icon={MapPin} value={form.address} onChange={u("address")} required />
          <Field label="Contact Number" icon={Phone} value={form.contactNumber} onChange={u("contactNumber")} type="tel" required />
          <Field label="Official Email" icon={Mail} value={form.officialEmail} onChange={u("officialEmail")} type="email" required />
          <Field label="Industry Type" icon={Package} value={form.industryType} onChange={u("industryType")} />
          <Field label="Product Categories" icon={Pill} value={form.productCategories} onChange={u("productCategories")} />
          <Field label="Website URL" icon={Globe} value={form.websiteUrl} onChange={u("websiteUrl")} type="url" placeholder="https://www.company.com" />
          <Field label="Manufacturing Capacity" icon={Package} value={form.manufacturingCapacity} onChange={u("manufacturingCapacity")} />
          <Field label="Certifications" icon={Shield} value={form.certifications} onChange={u("certifications")} />
          <Field label="Operating Countries" icon={Globe} value={form.operatingCountries} onChange={u("operatingCountries")} />
          <Field label="Registration Date" icon={Calendar} value={form.registrationDate} onChange={u("registrationDate")} type="date" />
        </div>
        <div className="mt-4">
          <TextArea label="Company Description" icon={FileText} value={form.companyDescription} onChange={u("companyDescription")} placeholder="Describe your company..." rows={4} />
        </div>
        <div className="mt-6 flex justify-end"><SaveButton saving={saving} onSave={save} /></div>
      </motion.div>

      <ComplianceDocuments />
    </div>
  );
}

/* ─── PHARMACY PROFILE ─── */
function PharmacyProfile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState<PharmacyProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const u = (key: keyof PharmacyProfileType) => (v: string) =>
    setForm((f) => f ? { ...f, [key]: v } : null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await pharmacyService.getProfile();
    if (res.success && res.data) {
      setForm(res.data);
    } else {
      setLoadError(res.error?.message ?? "Failed to load profile.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const res = await pharmacyService.updateProfile(form);
    setSaving(false);

    if (res.success && res.data) {
      setForm(res.data);
      updateUser({ fullName: res.data.name });
      toast.success("Profile updated", {
        description: "Your pharmacy profile has been saved.",
      });
      return;
    }

    toast.error(res.error?.message ?? "Failed to save profile.");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await pharmacyService.uploadLicense(formData);
    setUploading(false);

    if (res.success && res.data) {
      setForm(res.data);
      toast.success("License uploaded successfully", {
        description: "Your license has been submitted to DRAP Admin for review.",
      });
      // Sync verification status in auth session
      updateUser({ isVerified: res.data.isVerified });
    } else {
      toast.error(res.error?.message ?? "Failed to upload license.");
    }
  };

  const handleDownload = () => {
    if (!form || !form.licenseDocumentUrl) return;

    if (form.licenseDocumentUrl.startsWith("http://") || form.licenseDocumentUrl.startsWith("https://")) {
      window.open(form.licenseDocumentUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const session = getStoredSession();
    if (!session?.token) {
        toast.error("Session expired. Please log in again.");
        return;
    }
    
    toast.promise(
        fetch(form.licenseDocumentUrl, {
            headers: { Authorization: `Bearer ${session.token}` },
        })
            .then((res) => {
                if (!res.ok) {
                    return Promise.reject("Download failed.");
                }
                return res.blob();
            })
            .then((blob) => {
                const url = URL.createObjectURL(blob as Blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `drap-pharmacy-license-${form.licenseNumber}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }),
        {
            loading: "Downloading license document...",
            success: "License document downloaded.",
            error: "Failed to download license document.",
        }
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Loading pharmacy profile…</p>
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="card-premium p-8 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-sm text-destructive">{loadError ?? "Unable to load profile."}</p>
        <Button onClick={() => void loadProfile()} variant="outline" className="rounded-xl">
          Try again
        </Button>
      </div>
    );
  }

  const badgeText = 
    form.verificationStatus === "VERIFIED" ? "Verified" :
    form.verificationStatus === "PENDING" ? "Pending Verification" :
    form.verificationStatus === "REJECTED" ? "Rejected" : "Unverified";

  return (
    <div className="space-y-6">
      <AvatarSection
        name={form.name || user?.fullName || "Pharmacy"}
        subtitle="Pharmacy Account"
        badge={badgeText}
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Pharmacy Information Form */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, ease }} 
          className="card-premium p-6 md:col-span-2"
        >
          <h3 className="text-[15px] font-semibold mb-5 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />Pharmacy Information
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pharmacy Name" icon={Building2} value={form.name} onChange={u("name")} required />
            <Field label="DRAP Pharmacy License #" icon={Shield} value={form.licenseNumber} onChange={u("licenseNumber")} required placeholder="DRAP-PH-2023-004521" />
            <Field label="Location" icon={MapPin} value={form.location} onChange={u("location")} required placeholder="Karachi, DHA Phase 6" />
            <Field label="Full Address" icon={MapPin} value={form.address} onChange={u("address")} required placeholder="Shop 12, Bukhari Commercial" />
            <Field label="Contact Number" icon={Phone} value={form.businessPhone} onChange={u("businessPhone")} type="tel" required placeholder="+92 300 1234567" />
            <Field label="Business Email" icon={Mail} value={form.businessEmail} onChange={u("businessEmail")} type="email" required placeholder="contact@pharmacy.com" />
          </div>
          <div className="mt-6 flex justify-end"><SaveButton saving={saving} onSave={save} /></div>
        </motion.div>

        {/* License Verification Card */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, ease, delay: 0.1 }} 
          className="card-premium p-6 flex flex-col justify-between"
        >
          <div>
            <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />License Verification
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Upload your official DRAP Pharmacy License to get verified and gain access to the stock scanning features.
            </p>

            {/* Status Display */}
            <div className="mb-6 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Status</span>
                <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border ${
                  form.verificationStatus === "VERIFIED"
                    ? "bg-success/15 border-success/30 text-success"
                    : form.verificationStatus === "PENDING"
                      ? "bg-warning/15 border-warning/30 text-warning-foreground"
                      : form.verificationStatus === "REJECTED"
                        ? "bg-destructive/15 border-destructive/30 text-destructive"
                        : "bg-secondary/40 border-border/50 text-muted-foreground"
                }`}>
                  {badgeText}
                </span>
              </div>

              {form.verificationStatus === "REJECTED" && form.remarks && (
                <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/10 text-[11px] text-destructive">
                  <p className="font-semibold mb-0.5">Rejection Remarks:</p>
                  <p>{form.remarks}</p>
                </div>
              )}

              {form.verificationStatus === "VERIFIED" && form.verifiedAt && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  Verified on {new Date(form.verifiedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border/20">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
              className="hidden"
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || form.verificationStatus === "VERIFIED"}
              className="w-full h-11 rounded-xl bg-gradient-primary shadow-elegant text-[13px] font-medium transition-all hover:scale-[1.02] gap-1.5"
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-4 w-4" /> Upload License File</>
              )}
            </Button>

            {form.licenseDocumentUrl && (
              <Button
                variant="outline"
                onClick={handleDownload}
                className="w-full h-11 rounded-xl text-[13px] font-medium border-border/60 hover:bg-secondary/30 gap-1.5"
              >
                <FileText className="h-4 w-4" /> Download Uploaded License
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── PATIENT PROFILE ─── */
function PatientProfile() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user?.fullName || "", email: user?.email || "", phone: "+92 300 1234567",
    city: "Karachi, Pakistan", dob: "1995-06-15",
  });
  const u = (key: string) => (v: string) => setForm(f => ({ ...f, [key]: v }));
  const save = async () => { setSaving(true); await new Promise(r => setTimeout(r, 1200)); setSaving(false); toast.success("Profile updated", { description: "Your profile has been saved." }); };

  return (
    <div className="space-y-6">
      <AvatarSection name={form.name} subtitle="Patient Account" badge="Verified" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="card-premium p-6">
        <h3 className="text-[15px] font-semibold mb-5 flex items-center gap-2"><User className="h-4 w-4 text-primary" />Personal Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name" icon={User} value={form.name} onChange={u("name")} required />
          <Field label="Email Address" icon={Mail} value={form.email} onChange={u("email")} type="email" required />
          <Field label="Phone Number" icon={Phone} value={form.phone} onChange={u("phone")} type="tel" />
          <Field label="City" icon={MapPin} value={form.city} onChange={u("city")} />
          <Field label="Date of Birth" icon={Calendar} value={form.dob} onChange={u("dob")} type="date" />
        </div>
        <div className="mt-6 flex justify-end"><SaveButton saving={saving} onSave={save} /></div>
      </motion.div>
    </div>
  );
}

/* ─── Avatar Header ─── */
function AvatarSection({
  name,
  subtitle,
  badge,
  logoUrl,
  onLogoUpload,
  onLogoDelete,
  uploading = false,
}: {
  name: string;
  subtitle: string;
  badge: string;
  logoUrl?: string;
  onLogoUpload?: (file: File) => void;
  onLogoDelete?: () => void;
  uploading?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase() || "U";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onLogoUpload) {
      onLogoUpload(file);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}
      className="card-premium p-6 flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0">
        <div className="relative group overflow-hidden rounded-2xl h-20 w-20 shadow-elegant border border-border/40 bg-secondary/10">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name}
              className="h-full w-full object-cover"
              onError={(e) => {
                // If logo fails to load, show initials
                (e.target as HTMLImageElement).style.display = "none";
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  const placeholder = document.createElement("div");
                  placeholder.className = "grid h-full w-full place-items-center bg-gradient-primary text-2xl font-bold text-primary-foreground";
                  placeholder.innerText = initials;
                  parent.appendChild(placeholder);
                }
              }}
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-primary text-2xl font-bold text-primary-foreground">{initials}</div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      </div>

      <div className="text-center sm:text-left flex-1 min-w-0">
        <h2 className="text-[20px] font-bold truncate">{name}</h2>
        <p className="text-[13px] text-muted-foreground truncate">{subtitle}</p>
        <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
          badge === "Unverified" || badge === "Pending Verification"
            ? "bg-warning/10 border border-warning/20 text-warning-foreground"
            : "bg-success/10 border border-success/20 text-success"
        }`}>
          {badge === "Unverified" || badge === "Pending Verification" ? (
            <Clock className="h-3 w-3" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )} {badge}
        </span>
      </div>

      {(onLogoUpload || onLogoDelete) && (
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
          />

          {!logoUrl ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl h-10 gap-2 text-[12px] font-semibold border-primary/20 hover:bg-primary/5 text-primary"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Logo
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-xl h-10 gap-2 text-[12px] flex-1 sm:flex-initial"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Change
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogoDelete}
                disabled={uploading}
                className="rounded-xl h-10 w-10 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center justify-center shrink-0"
                title="Remove Logo"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
