export const TEAM_PROFILES = {
  'tessa@heyday.com': {
    role: 'Operations',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDrvy7ujs956qE5TqBGfdyWvGAHX47JuUY9yIupIFwJhUlk1WMzZNYRez9C5GcWsvbp6PjnR6J4vUdZSRn3NAn6HC1I2anPuwqdz5R8plA-OvaqcB3qedHiX8YQDwUBIW5EnuBNCpA_fOlJBTBjCi3lcxDXmKoCTW-W5ktQvtC8vxruak6GB7jRJkpL6tAGeGOdRGmJ5MIupFJ-bAXshbOQk4KWzh9vl-htrYbVCHQinG7T02GCTfeDKalSSuYjkM4N87cyeTYuThKX',
  },
  'adam@heyday.com': {
    role: 'Marketing',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_4jvAHw0ZSDFuiJFStXZh6AYam1hxslmKbeg2winfac8lqrqVchHG0dVMfBuwR5IIipOBMF7e_NuqRtHYU6vac25EKoC_nksow6mGGtfkbxaCGZnkvWc1_ESIwtdcKJfSxZlXvCr9Qw_jGtlEhXQ9t0Cv7m0KGSg1KwDIvxRaAzB-C5nUvg_46JFsq_2vTGRYKcArNmTVaL3RM_2-GCqNsvH45kLxAMbyCNU4-afvRcUUODcmZ5nChKtAIYFgsdd_LKARVYi2cN_f',
  },
  'margaret@heyday.com': {
    role: 'Analyst',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA1WBZZINJeEZuZst4fvs8vBl99n5eo2dlpoPKzWI69n4fH_GdHAxUKl7At1vKXPRWQBY7FekutXO4tkDSq5mYbnhF8gEXO04TfDPgYMngwm1vEN3eY9dkquubdA69HGyYWQCgd-kRv8EyZtycgeUOeMdvJvd1va9ViH3ObzDO5Pf_bINS0e7I4LG5OSq8wjZ5g1aObyzAXwKo3m2Hv0fYZwisUkcwJ7Phci3oiUwdVQcbS-Q1F1J0BaQ4CFZ-zseDn4ZLSjfoEjHer',
  },
  'meredith@heyday.com': {
    role: 'Owner/Lead',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB6G29AFEr-WYjk8f9o3ooVDeYw9zw_0c_DI_SrbDkLJjmsOEyQJi8nRGAMkdqboyJCdLgVwarDwdW9ptRN3wZE85xUKH4Onfi703M3RQ_CgltzBhMXKuB0TbSZ_71oDxNz_HIDazmUJwpwvzN78RWRoT25IkldmeK9T3XhQ6wGKtJVnA47r0nkByh0rWxr8UOkJF_UVKbrgPLwafC0GTcoSIuMZz6A01kfdQ7vrCK7MEUTOfmrIzq_FhB8HdOZYBkIxKe1BA9SFM5D',
  },
};

export function getTeamProfile(email) {
  return TEAM_PROFILES[email] || { role: 'Team Member', img: null };
}
