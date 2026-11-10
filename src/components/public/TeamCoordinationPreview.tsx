import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  MapPin,
  PhoneCall,
  Radio,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

interface ResponseTeam {
  id: string;
  name: string;
  type: string;
  lead: string;
  membersCount: number;
  specialty: string;
  assignedIncident: string | null;
  status: "available" | "deployed" | "standby";
  equipment: string;
}

const teamsList: ResponseTeam[] = [
  {
    id: "team-1",
    name: "Swiftwater Search & Rescue Task Force 1",
    type: "Water / Flood Rescue",
    lead: "Capt. Rebecca Vance",
    membersCount: 8,
    specialty: "High-velocity river flood extraction, inflatable boats",
    assignedIncident: "INC-2026-039 (Cedar Fork River)",
    status: "deployed",
    equipment: "3 Zodiac inflatable rescue boats, sonar, drysuits",
  },
  {
    id: "team-2",
    name: "AeroMedical Evacuation Flight Crew 4",
    type: "Critical Care EMS",
    lead: "Dr. Marcus Lin, MD",
    membersCount: 4,
    specialty: "High-altitude triage, airborne ICU, rapid transport",
    assignedIncident: "INC-2026-041 (Highland Ridge Fire)",
    status: "deployed",
    equipment: "Air Ambulance Helicopter, portable ventilators",
  },
  {
    id: "team-3",
    name: "Hazmat & Chemical Neutralization Squad",
    type: "Hazardous Materials",
    lead: "Lt. Daniel Gomez",
    membersCount: 6,
    specialty: "Industrial spill containment, atmospheric vapor monitoring",
    assignedIncident: null,
    status: "available",
    equipment: "Level A containment suits, decontam trailer",
  },
  {
    id: "team-4",
    name: "Urban Search & Structural Collapse Task Force",
    type: "Urban USAR",
    lead: "Sgt. Sarah Jenkins",
    membersCount: 10,
    specialty: "Canine scent tracking, acoustic listening devices, shoring",
    assignedIncident: null,
    status: "standby",
    equipment: "Search cameras, heavy hydraulic jacks, search dogs",
  },
];

export function TeamCoordinationPreview() {
  const [selectedTeamId, setSelectedTeamId] = useState<string>("team-1");

  const activeTeam =
    teamsList.find((t) => t.id === selectedTeamId) ?? teamsList[0];

  return (
    <section className="landing-team-section" id="response-teams">
      <div className="landing-width">
        <div className="landing-section-top">
          <div>
            <span className="eyebrow">Squads & Tactical Units</span>
            <h2>
              Response Team Coordination.
              <br />
              <span>Unified command for field specialists and responders.</span>
            </h2>
          </div>
          <div>
            <p>
              Organize multi-agency teams, assign qualified team leads, deploy squads
              directly to active incidents, and ensure field officers access real-time
              incident scope.
            </p>
            <div className="demo-simulation-tag">
              <span className="live-dot" /> Multi-Agency Coordination · Active
              Dispatch
            </div>
          </div>
        </div>

        <div className="team-coordination-grid">
          {/* Left: Interactive Team Cards */}
          <div className="teams-cards-stack">
            {teamsList.map((team) => {
              const isSelected = team.id === activeTeam.id;
              return (
                <div
                  key={team.id}
                  className={`team-selection-card ${isSelected ? "selected" : ""} team-status-${team.status}`}
                  onClick={() => setSelectedTeamId(team.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedTeamId(team.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="team-card-header">
                    <div className="team-name-badge">
                      <span className="team-type-tag">{team.type}</span>
                      <h4>{team.name}</h4>
                    </div>
                    <span className={`team-status-badge status-${team.status}`}>
                      {team.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="team-card-subinfo">
                    <span>
                      <UserCheck size={14} /> Lead: {team.lead}
                    </span>
                    <span>
                      <Users size={14} /> {team.membersCount} Specialists
                    </span>
                  </div>

                  {team.assignedIncident && (
                    <div className="team-assigned-banner">
                      <MapPin size={13} /> Assigned: {team.assignedIncident}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Team Dossier & Tactical Panel */}
          <div className="team-dossier-panel">
            <div className="dossier-header">
              <div className="dossier-meta-top">
                <span className="dossier-type">{activeTeam.type}</span>
                <span className={`dossier-pill pill-${activeTeam.status}`}>
                  {activeTeam.status === "deployed"
                    ? "In Theater (Deployed)"
                    : activeTeam.status === "available"
                      ? "Ready for Instant Dispatch"
                      : "Standby in Depot"}
                </span>
              </div>
              <h3>{activeTeam.name}</h3>
              <p className="specialty-text">{activeTeam.specialty}</p>
            </div>

            <div className="dossier-details-grid">
              <div className="dossier-stat-box">
                <span className="box-label">TEAM LEADERSHIP</span>
                <strong>{activeTeam.lead}</strong>
                <small>Designated Incident Commander Contact</small>
              </div>

              <div className="dossier-stat-box">
                <span className="box-label">SQUAD STRENGTH</span>
                <strong>{activeTeam.membersCount} Responders</strong>
                <small>Certified Specialized Personnel</small>
              </div>

              <div className="dossier-stat-box span-full">
                <span className="box-label">TACTICAL EQUIPMENT INVENTORY</span>
                <p className="equipment-text">{activeTeam.equipment}</p>
              </div>

              <div className="dossier-stat-box span-full">
                <span className="box-label">ASSIGNMENT DISPATCH STATUS</span>
                {activeTeam.assignedIncident ? (
                  <div className="active-assignment-callout">
                    <Radio size={16} className="radio-pulse" />
                    <div>
                      <strong>Active Deployment:</strong> {activeTeam.assignedIncident}
                      <small>Field communications channel synced</small>
                    </div>
                  </div>
                ) : (
                  <div className="standby-callout">
                    <CheckCircle2 size={16} />
                    <span>No active incident conflict. Ready for assignment.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="dossier-footer">
              <Link to="/login" className="button team-cta">
                Manage Teams in Platform <ArrowRight size={17} />
              </Link>
              <span className="dossier-subtext">
                <Shield size={14} /> Strict 1-active-assignment constraint per team
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

