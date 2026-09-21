const fs = require('fs');

async function fetchSpec() {
  const res = await fetch('https://kfbjslarywvmijjdshqu.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYmpzbGFyeXd2bWlqamRzaHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4NDk0NTQsImV4cCI6MjEwNTQyNTQ1NH0.f83RELmzLNYsBpSSjFYY-o54Dk6BAeTb4hFPeQ_oKis');
  const data = await res.json();
  
  // Find study_group_members definition to see relationships
  const table = data.definitions.study_group_members;
  console.log("study_group_members schema:");
  console.log(JSON.stringify(table, null, 2));
}

fetchSpec();

