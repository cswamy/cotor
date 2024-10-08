import { React, useState, useEffect } from 'react';

// Import mui components
import {
    Box,
    Typography,
    Grid,
    TextField,
    useTheme,
    useMediaQuery,
    Button,
    Alert,
    Collapse,
    CircularProgress,
} from '@mui/material';

// Import custom components
import HeaderMenu from '../HeaderMenu/HeaderMenu';

// Import networking
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import axios from 'axios';

const SearchIssue = () => {

    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const navigate = useNavigate();
    const [token, setToken] = useState(null);
    const [dataLoading, setDataLoading] = useState(false);

    // Input and search button logic
    const [ghLink, setGhLink] = useState('');
    const [issueNumber, setIssueNumber] = useState('');
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [buttonClicked, setButtonClicked] = useState(false);
    const ENTER_KEY_CODE = 13;

    // Shared issue logic
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');

    useEffect(() => {
        const getUser = async () => {
            const {data, error} = await supabase.auth.getSession();
            if (error) {
                console.log('Error');
            } else {
                setToken(data['session']['provider_token']);
            }
        }

        getUser();
    }, []);

    useEffect(() => {
        const getSharedIssueData = async () => {
            const { data, error } = await supabase
                .from('Issues')
                .select('*')
                .eq('public_link_id', id);
            if (error) {
                setDataLoading(false);
                setAlertMessage('Invalid link. Please try searching instead.')
                setShowAlert(true);
            } else {
                if (data.length > 0) {
                    setDataLoading(false);
                    navigate(
                        '/issue',
                        {
                            'state': {
                                'owner': data[0]['repo_owner'],
                                'repo': data[0]['repo'],
                                'issue': data[0]['issue_id'],
                                'issue_url': data[0]['issue_url'],
                                'issue_title': data[0]['issue_title'],
                                'issue_body': data[0]['issue_body'],
                                'is_pull_request': data[0]['is_pull_request'],
                                'dbData': data[0],
                                'token': token,
                            }
                        }
                    );
                }
            }
        };
        
        if (id) {
            setDataLoading(true);
            getSharedIssueData();
        }
    }, [id, token, navigate]); 

    const handleGHLinkChange = (event) => {
        setGhLink(event.target.value);
    };

    const handleissueNumberChange = (event) => {
        setIssueNumber(event.target.value);
    };

    const handleEnterKey = (event) => {
        if (event.keyCode === ENTER_KEY_CODE) {
          event.preventDefault();
          searchClicked();
        }
      }

    const searchClicked = async () => {
        setButtonClicked(true);
        if (ghLink === '' || issueNumber === '') {
            setAlertMessage('Please enter a GitHub link and a pull request or issue number.');
            setShowAlert(true);
        } else {
            ghLink.trim();
            let domain = ghLink.split('/')[2];
            let owner = ghLink.split('/')[3];
            let repo = ghLink.split('/')[4];
            if (!owner || !repo || domain !== 'github.com' || isNaN(Number(issueNumber))) {
                setAlertMessage('Invalid inputs. Please check and try again.');
                setShowAlert(true);
            } else {
                // First try dB
                const { data, error } = await supabase
                    .from('Issues')
                    .select('*')
                    .eq('repo_owner', owner)
                    .eq('repo', repo)
                    .eq('issue_id', issueNumber);
                if (error) {
                    // do nothing
                } else {
                    if (data.length > 0) {
                        navigate(
                            '/issue',
                            {
                                'state': {
                                    'owner': owner,
                                    'repo': repo,
                                    'issue': issueNumber,
                                    'issue_url': data[0]['issue_url'],
                                    'issue_title': data[0]['issue_title'],
                                    'issue_body': data[0]['issue_body'],
                                    'is_pull_request': data[0]['is_pull_request'],
                                    'dbData': data[0],
                                    'token': token,
                                }
                            }
                        );
                        return;
                    }
                }
                // If not in dB, then check API
                let response;
                try {
                    let url = process.env.REACT_APP_API_VALIDATE_INPUT + owner + '/' + repo;
                    response = await axios.request({
                        method: 'GET',
                        url: url,
                        headers: {
                            Authorization: 'Bearer ' + token
                        },
                        params: {
                            issue: issueNumber,
                        },
                    });
                } catch (err) {
                    setAlertMessage('Oops something went wrong! Please try again.')
                    setShowAlert(true);
                    setButtonClicked(false);
                    return;
                }
                
                if (response.data.repo_exists === false) {
                    setAlertMessage('Could not find repository. Please check and try again.')
                    setShowAlert(true);
                } else if (response.data.issue_exists === false) {
                    setAlertMessage('Could not find pull request or issue. Please check and try again.')
                    setShowAlert(true);
                } else if (response.data.issue_status === 'open') {
                    if (response.data.is_pull_request === true) {
                        setAlertMessage('Pull request is still open. Please try again with a closed PR.')
                        setShowAlert(true);
                    } else {
                        setAlertMessage('Issue is still open. Please try again with a closed issue.')
                        setShowAlert(true);
                    }
                } else if (response.data.issue_status === 'pr_closed_without_merge') {
                    setAlertMessage('This pull request was not merged.')
                    setShowAlert(true);
                } else if (response.data.issue_status === 'issue_closed_without_pr') {
                    setAlertMessage('Issue was closed without a linked pull request.')
                    setShowAlert(true);
                } else {
                    navigate(
                        '/issue',
                        {
                            'state': {
                                'owner': owner,
                                'repo': repo,
                                'issue': issueNumber,
                                'issue_url': response.data.issue_url,
                                'issue_title': response.data.issue_title,
                                'issue_body': response.data.issue_body,
                                'is_pull_request': response.data.is_pull_request,
                                'dBData': null,
                                'token': token,
                            }
                        }
                    );
                }
            }
        }
        setButtonClicked(false);
    };

    useEffect(() => {
        if (setShowAlert) {
          const timer = setTimeout(() => {
            setShowAlert(false);
            setAlertMessage('');
          }, 2000);
      
          return () => {
            clearTimeout(timer);
          };
        }
      }, [showAlert]);

    return (
        <Box>
            <Box>
                <Collapse in={showAlert} transition='auto' easing='ease-out'>
                    <Alert severity='error'>
                        {alertMessage}
                    </Alert>   
                </Collapse>

                {!showAlert && !buttonClicked &&
                <HeaderMenu page='search'/>
                }
            </Box>
            <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                mt: 8,
            }}>
                {dataLoading ?
                (
                <CircularProgress sx={{color: 'black'}}/>
                )
                :
                (
                <>
                <Box>
                    <Typography variant={isSmallScreen ? 'h2' : 'h1'} align="center">
                        Cotor
                    </Typography>
                </Box>
                <Grid container justify="center">
                    <Grid item xs={12}>
                        <Box 
                        width={isSmallScreen ? '70%' : '40%'} 
                        margin="auto"
                        sx={{mt: 3}}
                        >   
                            <Typography 
                            variant={isSmallScreen ? 'body1' : 'h6'} 
                            align="center"
                            sx={{mb: 1}}>
                            Paste link to a public GitHub repository
                            </Typography>
                            <TextField
                            size='small' 
                            fullWidth
                            placeholder='https://github.com/gradio-app/gradio'
                            value={ghLink}
                            onChange={handleGHLinkChange}
                            inputProps={{
                                style: {
                                    fontSize: isSmallScreen ? "0.8rem" : "1rem", 
                                    textAlign: "center" 
                                }
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                        borderColor: 'grey',
                                        borderRadius: '25px',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'black',
                                        border: '1px solid',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'black',
                                        border: '1px solid',
                                    },
                                },
                            }}
                            />
                        </Box>
                    </Grid>

                    <Grid item xs={12}>
                        <Box 
                        width={isSmallScreen ? '50%' : '30%'} 
                        margin="auto"
                        sx={{mt: 4}}
                        >   
                            <Typography 
                            variant={isSmallScreen ? 'body1' : 'h6'} 
                            align="center"
                            sx={{mb: 1}}>
                            Enter a pull request or issue
                            </Typography>
                            <TextField 
                            size='small'
                            fullWidth
                            placeholder='7139'
                            value={issueNumber}
                            onChange={handleissueNumberChange}
                            onKeyDown={handleEnterKey}
                            inputProps={{
                                style: {
                                    fontSize: isSmallScreen ? "0.8rem" : "1rem", 
                                    textAlign: "center" 
                                }
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': {
                                        borderColor: 'grey',
                                        borderRadius: '25px',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'black',
                                        border: '1px solid',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'black',
                                        border: '1px solid',
                                    },
                                },
                            }}
                            />
                        </Box>
                    </Grid>

                    <Grid item xs={12}>
                        <Box 
                        margin="auto"
                        sx={{mt: 3, display: 'flex', justifyContent: 'center'}}
                        >   
                            <Button
                            sx={{
                                backgroundColor: '#dadada',
                                color: 'black',
                                borderRadius: '25px',
                                '&:hover': {
                                    backgroundColor: 'black',
                                    color: 'white',
                                },
                                textTransform: 'none',
                                width: isSmallScreen ? '30%' : '10%',
                            }}
                            onClick={searchClicked}
                            disabled={buttonClicked}
                            >
                                {buttonClicked ? 'Searching . . .' : 'Search'}
                            </Button>
                        </Box>
                    </Grid>

                </Grid>
                </>
                )}
            </Box>
        </Box>
    );
};

export default SearchIssue;