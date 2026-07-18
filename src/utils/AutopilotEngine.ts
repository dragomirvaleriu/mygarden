import { db, collection, addDoc, doc, updateDoc } from '../../services/firebase';
import { GardenTask } from '../types';

interface WeatherForecast {
  temperatureMax: number;
  precipitationAmount: number; // mm
  precipitationProbability: number;
}

interface RescheduleResult {
  updatedTasks: GardenTask[];
  logs: string[];
}

/**
 * AutopilotEngine: Evaluates upcoming tasks against extreme weather rules
 * and automatically reschedules them to protect the garden.
 */
export const runAutopilot = async (
  tasks: GardenTask[],
  forecast: WeatherForecast,
  organizationId: string,
  userId: string
): Promise<RescheduleResult> => {
  const logs: string[] = [];
  const updatedTasks: GardenTask[] = [];

  const now = new Date();
  
  for (const task of tasks) {
    if (task.status === 'completed') continue;
    
    // Convert timestamp to Date object if needed
    const due = task.nextDue?.toDate ? task.nextDue.toDate() : new Date(task.nextDue);
    
    // Only autopilot tasks due today or tomorrow
    const isDueSoon = due.getTime() - now.getTime() < 48 * 60 * 60 * 1000;
    if (!isDueSoon) continue;

    let rescheduled = false;
    let newDate = new Date(due);
    let reason = '';

    // RULE 1: Heatwave (Caniculă)
    // If temp > 32°C, delay treatments and fertilizers by 3 days
    if (forecast.temperatureMax > 32) {
      if (
        task.category === 'treatment' || 
        task.category === 'fertilizing' ||
        task.title.toLowerCase().includes('tratament') || 
        task.title.toLowerCase().includes('fertilizare')
      ) {
        newDate.setDate(newDate.getDate() + 3);
        reason = `Am amânat "${task.title}" programată azi din cauza caniculei (${forecast.temperatureMax}°C). Reprogramată peste 3 zile pentru a evita arderea foliajului.`;
        rescheduled = true;
      }
    }

    // RULE 2: Heavy Rain (Ploaie torențială)
    // If rain > 5mm, delay mowing by 2 days
    if (!rescheduled && forecast.precipitationAmount > 5) {
      if (
        task.category === 'mowing' || 
        task.category === 'tuns' ||
        task.title.toLowerCase().includes('tuns') ||
        task.title.toLowerCase().includes('tundere')
      ) {
        newDate.setDate(newDate.getDate() + 2);
        reason = `Am amânat "${task.title}" programată azi din cauza precipitațiilor (${forecast.precipitationAmount}mm). Reprogramată peste 2 zile pe vreme însorită.`;
        rescheduled = true;
      }
    }

    if (rescheduled) {
      // 1. Update task in Firebase
      try {
        const taskRef = doc(db, 'garden_tasks', task.id);
        await updateDoc(taskRef, {
          nextDue: newDate,
          notes: task.notes ? `${task.notes}\n[Autopilot] ${reason}` : `[Autopilot] ${reason}`
        });

        updatedTasks.push({ ...task, nextDue: newDate });
        logs.push(reason);

        // 2. Add to Garden Journal (Activity Log)
        await addDoc(collection(db, 'garden_journal'), {
          organizationId,
          userId,
          type: 'system_auto',
          date: new Date(),
          details: reason,
          performedByName: '🤖 SISTEM',
          createdAt: new Date(),
        });
      } catch (error) {
        console.error(`Autopilot failed to update task ${task.id}`, error);
      }
    }
  }

  return { updatedTasks, logs };
};
