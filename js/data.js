/**
 * CareMom - Initial Data Structures (Empty by default for real user data)
 */

const INITIAL_PATIENT_PROFILE = {
  name: "Načítání pacientky...",
  birthDate: "",
  age: 0,
  diagnosis: "Načítání údajů...",
  surgeryDate: new Date().toISOString().split('T')[0],
  hospital: "Nemocnice",
  attendingDoctor: "Ošetřující lékař",
  gpDoctor: "Praktický lékař",
  bloodType: "",
  allergies: "Žádné",
  insuranceCompany: "",
  insuranceNumber: ""
};

const INITIAL_DOCUMENTS = [];
const INITIAL_CARE_LOGS = [];
const INITIAL_MEDICATIONS = [];
const INITIAL_CONTACTS = [];
const INITIAL_REMINDERS = [];
const INITIAL_CAREGIVERS = [];
const INITIAL_REHAB_RULES = [];
