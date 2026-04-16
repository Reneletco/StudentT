"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Briefcase, Github, MessageSquare } from "lucide-react"

interface MentorCardProps {
  name: string
  avatar?: string
  skills: string[]
  bio?: string
  company?: string
  github?: string
  workExperience?: string
  pitch?: string
  isBooked?: boolean
  onBook?: () => void
  className?: string
}

export function MentorCard({
  name,
  avatar,
  skills,
  bio,
  company,
  github,
  workExperience,
  pitch,
  isBooked,
  onBook,
  className
}: MentorCardProps) {
  return (
    <div className={cn(
      "bg-card rounded-3xl border border-border p-6",
      "hover:shadow-lg hover:shadow-black/5 hover:border-transparent",
      "transition-all duration-300",
      className
    )}>
      <div className="flex gap-5">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-20 h-20 rounded-2xl bg-secondary overflow-hidden flex items-center justify-center">
            {avatar ? (
              <img src={avatar} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{name}</h3>
              {company && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>{company}</span>
                </div>
              )}
            </div>
            
            <Button
              onClick={onBook}
              disabled={isBooked}
              className={cn(
                "rounded-full px-5",
                isBooked 
                  ? "bg-secondary text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {isBooked ? "Вы записаны" : "Записаться"}
            </Button>
          </div>
          
          {/* Skills */}
          <div className="flex flex-wrap gap-2 mt-3">
            {skills.map((skill) => (
              <span 
                key={skill}
                className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-full"
              >
                {skill}
              </span>
            ))}
          </div>
          
          {/* Bio */}
          {bio && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              {bio}
            </p>
          )}
          
          {/* Work Experience */}
          {workExperience && (
            <div className="mt-3 text-sm">
              <span className="font-medium">Стаж:</span>{" "}
              <span className="text-muted-foreground">{workExperience}</span>
            </div>
          )}
          
          {/* Mentor Pitch */}
          {pitch && (
            <div className="mt-4 p-4 bg-secondary/50 rounded-2xl">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <MessageSquare className="w-4 h-4" />
                <span>Сообщение от ментора</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{pitch}</p>
            </div>
          )}
          
          {/* GitHub */}
          {github && (
            <a 
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-3 transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
