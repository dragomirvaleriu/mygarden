import os

files = [
    'components/dashboard/ActivityHeatmap.tsx',
    'components/dashboard/GardenGallery.tsx',
    'components/dashboard/MonthlyForecastWidget.tsx',
    'components/dashboard/TopClientsWidget.tsx'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    content = content.replace("../../src/components/ui/tooltip", "../ui/tooltip")
    
    if "ActivityHeatmap.tsx" in file:
        content = content.replace("import React from 'react';", "import React from 'react';\nimport { ro, enUS } from 'date-fns/locale';\nimport { parseISO } from 'date-fns';")
        
    if "GardenGallery.tsx" in file:
        content = content.replace("import React", "import React, { useMemo }")
        content = content.replace("export const GardenGallery", "import { Image } from 'lucide-react';\nexport const GardenGallery")
        
    if "MonthlyForecastWidget.tsx" in file:
        content = content.replace("export const MonthlyForecastWidget", "import { CloudRain } from 'lucide-react';\nexport const MonthlyForecastWidget")
        
    if "TopClientsWidget.tsx" in file:
        content = content.replace("export const TopClientsWidget", "import { Page } from '../../src/types';\nexport const TopClientsWidget")
        
    with open(file, 'w') as f:
        f.write(content)

# Fix Dashboard.tsx missing imports
with open('pages/Dashboard.tsx', 'r') as f:
    dashboard_content = f.read()

# I used an incorrect search earlier for Dashboard.tsx imports when inserting them. Let's fix that.
# I'll just append them at the top.
imports = """
import { ActivityHeatmap } from '../components/dashboard/ActivityHeatmap';
import { GardenGallery } from '../components/dashboard/GardenGallery';
import { MonthlyForecastWidget } from '../components/dashboard/MonthlyForecastWidget';
import { TopClientsWidget } from '../components/dashboard/TopClientsWidget';
"""
if "import { ActivityHeatmap }" not in dashboard_content:
    dashboard_content = dashboard_content.replace("import React,", imports + "\nimport React,")
    
with open('pages/Dashboard.tsx', 'w') as f:
    f.write(dashboard_content)

print("Fixed imports")
